import { db } from "@/lib/db";
import { orders, cards, products, loginUsers as users } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import { isPaymentOrder } from "@/lib/payment";
import { notifyAdminPaymentSuccess } from "@/lib/notifications";
import { sendOrderEmail } from "@/lib/email";

export async function processOrderFulfillment(orderId: string, paidAmount: number, tradeNo: string) {
    const order = await db.query.orders.findFirst({
        where: eq(orders.orderId, orderId)
    });

    if (!order) {
        throw new Error(`Order ${orderId} not found`);
    }

    // Verify Amount (Prevent penny-dropping)
    const orderMoney = parseFloat(order.amount);

    // Allow small float epsilon difference
    if (Math.abs(paidAmount - orderMoney) > 0.01) {
        throw new Error(`Amount mismatch! Order: ${orderMoney}, Paid: ${paidAmount}`);
    }

    if (isPaymentOrder(order.productId)) {
        if (order.status === 'pending' || order.status === 'cancelled') {
            await db.update(orders)
                .set({
                    status: 'paid',
                    paidAt: new Date(),
                    tradeNo: tradeNo
                })
                .where(eq(orders.orderId, orderId));

            // Notify Admin
            const user = await db.query.loginUsers.findFirst({
                where: eq(users.userId, order.userId || ''),
                columns: { username: true }
            }).catch(() => null);

            await notifyAdminPaymentSuccess({
                orderId: orderId,
                productName: "Payment (QR/Link)",
                amount: order.amount,
                username: user?.username,
                email: order.email,
                tradeNo: tradeNo
            });
        }
        return { success: true, status: 'processed' };
    }

    if (order.status === 'pending' || order.status === 'cancelled') {
        // Check if product is shared (infinite stock)
        const product = await db.query.products.findFirst({
            where: eq(products.id, order.productId),
            columns: {
                isShared: true,
                name: true
            }
        });

        const isShared = product?.isShared;

        if (isShared) {
            // For shared products:
            const availableCard = await db.select({ id: cards.id, cardKey: cards.cardKey })
                .from(cards)
                .where(sql`${cards.productId} = ${order.productId} AND COALESCE(${cards.isUsed}, 0) = 0`)
                .orderBy(sql`RANDOM()`)
                .limit(1);

            if (availableCard.length > 0) {
                const key = availableCard[0].cardKey;
                const cardKeys = Array(order.quantity || 1).fill(key);

                await db.update(orders)
                    .set({
                        status: 'delivered',
                        paidAt: new Date(),
                        deliveredAt: new Date(),
                        tradeNo: tradeNo,
                        cardKey: cardKeys.join('\n'),
                        currentPaymentId: null
                    })
                    .where(eq(orders.orderId, orderId));

                console.log(`[Fulfill] Shared product order ${orderId} delivered. Card: ${key}`);

                // Notify Admin
                const user = await db.query.loginUsers.findFirst({
                    where: eq(users.userId, order.userId || ''),
                    columns: { username: true }
                }).catch(() => null);

                await notifyAdminPaymentSuccess({
                    orderId: orderId,
                    productName: product?.name || 'Shared Product',
                    amount: order.amount,
                    username: user?.username,
                    email: order.email,
                    tradeNo: tradeNo
                });

                // Send email with card keys
                if (order.email) {
                    await sendOrderEmail({
                        to: order.email,
                        orderId: orderId,
                        productName: product?.name || 'Product',
                        cardKeys: cardKeys.join('\n')
                    }).catch(err => console.error('[Email] Send failed:', err));
                }

                return { success: true, status: 'processed' };
            } else {
                // No stock for shared product
                await db.update(orders)
                    .set({ status: 'paid', paidAt: new Date(), tradeNo: tradeNo })
                    .where(eq(orders.orderId, orderId));
                console.log(`[Fulfill] Order ${orderId} marked as paid (no stock for shared product)`);

                // Notify Admin
                const user = await db.query.loginUsers.findFirst({
                    where: eq(users.userId, order.userId || ''),
                    columns: { username: true }
                }).catch(() => null);

                await notifyAdminPaymentSuccess({
                    orderId: orderId,
                    productName: product?.name || 'Shared Product',
                    amount: order.amount,
                    username: user?.username,
                    email: order.email,
                    tradeNo: tradeNo
                });

                return { success: true, status: 'processed' };
            }
        }

        const quantity = order.quantity || 1;
        let cardKeys: string[] = [];
        const oneMinuteAgo = Date.now() - 60000;

        // 1. Reserved cards
        try {
            const reservedCards = await db.select({ id: cards.id, cardKey: cards.cardKey })
                .from(cards)
                .where(sql`${cards.reservedOrderId} = ${orderId} AND COALESCE(${cards.isUsed}, 0) = 0`)
                .limit(quantity);

            for (const card of reservedCards) {
                await db.update(cards)
                    .set({
                        isUsed: true,
                        usedAt: new Date(),
                        reservedOrderId: null,
                        reservedAt: null
                    })
                    .where(eq(cards.id, card.id));
                cardKeys.push(card.cardKey);
            }
        } catch (error: any) {
            console.log('[Fulfill] Reserved cards check failed:', error.message);
        }

        // 2. Available cards
        if (cardKeys.length < quantity) {
            const needed = quantity - cardKeys.length;
            const availableCards = await db.select({ id: cards.id, cardKey: cards.cardKey })
                .from(cards)
                .where(sql`${cards.productId} = ${order.productId} AND COALESCE(${cards.isUsed}, 0) = 0 AND (${cards.reservedAt} IS NULL OR ${cards.reservedAt} < ${oneMinuteAgo})`)
                .limit(needed);

            for (const card of availableCards) {
                await db.update(cards)
                    .set({
                        isUsed: true,
                        usedAt: new Date()
                    })
                    .where(eq(cards.id, card.id));
                cardKeys.push(card.cardKey);
            }
        }

        if (cardKeys.length > 0) {
            const joinedKeys = cardKeys.join('\n');

            await db.update(orders)
                .set({
                    status: 'delivered',
                    paidAt: new Date(),
                    deliveredAt: new Date(),
                    tradeNo: tradeNo,
                    cardKey: joinedKeys
                })
                .where(eq(orders.orderId, orderId));
            console.log(`[Fulfill] Order ${orderId} delivered successfully!`);

            // Notify Admin
            const user = await db.query.loginUsers.findFirst({
                where: eq(users.userId, order.userId || ''),
                columns: { username: true }
            }).catch(() => null);

            const product = await db.query.products.findFirst({
                where: eq(products.id, order.productId),
                columns: { name: true }
            });

            await notifyAdminPaymentSuccess({
                orderId: orderId,
                productName: product?.name || 'Unknown Product',
                amount: order.amount,
                username: user?.username,
                email: order.email,
                tradeNo: tradeNo
            });

            // Send email with card keys
            if (order.email) {
                await sendOrderEmail({
                    to: order.email,
                    orderId: orderId,
                    productName: product?.name || 'Product',
                    cardKeys: joinedKeys
                }).catch(err => console.error('[Email] Send failed:', err));
            }
        } else {
            // Paid but no stock
            await db.update(orders)
                .set({ status: 'paid', paidAt: new Date(), tradeNo: tradeNo })
                .where(eq(orders.orderId, orderId));
            console.log(`[Fulfill] Order ${orderId} marked as paid (no stock)`);

            // Notify Admin
            const user = await db.query.loginUsers.findFirst({
                where: eq(users.userId, order.userId || ''),
                columns: { username: true }
            }).catch(() => null);

            const product = await db.query.products.findFirst({
                where: eq(products.id, order.productId),
                columns: { name: true }
            });

            await notifyAdminPaymentSuccess({
                orderId: orderId,
                productName: product?.name || 'Unknown Product',
                amount: order.amount,
                username: user?.username,
                email: order.email,
                tradeNo: tradeNo
            });
        }
        return { success: true, status: 'processed' };
    } else {
        return { success: true, status: 'already_processed' };
    }
}
