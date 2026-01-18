'use server'

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { orders, refundRequests } from "@/lib/db/schema"
import { and, desc, eq, sql } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { checkAdmin } from "@/actions/admin"
import { products } from "@/lib/db/schema"
import { notifyAdminRefundRequest } from "@/lib/notifications"

async function ensureRefundRequestsTable() {
  await db.run(sql`
    CREATE TABLE IF NOT EXISTS refund_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id TEXT NOT NULL,
      user_id TEXT,
      username TEXT,
      reason TEXT,
      status TEXT DEFAULT 'pending',
      admin_username TEXT,
      admin_note TEXT,
      created_at INTEGER DEFAULT (unixepoch() * 1000),
      updated_at INTEGER DEFAULT (unixepoch() * 1000),
      processed_at INTEGER
    );
    CREATE INDEX IF NOT EXISTS refund_requests_order_id_idx ON refund_requests(order_id);
  `)
}

export async function requestRefund(orderId: string, reason: string) {
  const session = await auth()
  const user = session?.user
  if (!user?.id) throw new Error("Unauthorized")

  await ensureRefundRequestsTable()

  const order = await db.query.orders.findFirst({ where: eq(orders.orderId, orderId) })
  if (!order) throw new Error("Order not found")
  if (order.userId !== user.id) throw new Error("Unauthorized")

  const status = order.status || 'pending'
  if (status !== 'paid' && status !== 'delivered') throw new Error("Order is not refundable")

  const existing = await db.query.refundRequests.findFirst({
    where: and(eq(refundRequests.orderId, orderId), eq(refundRequests.userId, user.id)),
    orderBy: [desc(refundRequests.createdAt)],
  })
  if (existing && existing.status !== 'rejected' && existing.status !== 'processed') {
    return { ok: true }
  }

  await db.insert(refundRequests).values({
    orderId,
    userId: user.id,
    username: user.username || null,
    reason: (reason || '').trim() || null,
    status: 'pending',
    createdAt: new Date(),
    updatedAt: new Date(),
  })

  const product = await db.query.products.findFirst({
    where: eq(products.id, order.productId),
    columns: { name: true }
  })

  await notifyAdminRefundRequest({
    orderId,
    productName: product?.name || 'Unknown',
    amount: order.amount,
    username: user.username,
    reason: reason || null
  })

  revalidatePath(`/order/${orderId}`)
  revalidatePath('/admin/refunds')
  return { ok: true }
}

export async function adminApproveRefund(requestId: number, adminNote?: string) {
  await checkAdmin()
  await ensureRefundRequestsTable()

  const session = await auth()
  const username = session?.user?.username || null

  await db.update(refundRequests).set({
    status: 'approved',
    adminUsername: username,
    adminNote: adminNote || null,
    updatedAt: new Date(),
  }).where(eq(refundRequests.id, requestId))

  revalidatePath('/admin/refunds')
}

export async function adminRejectRefund(requestId: number, adminNote?: string) {
  await checkAdmin()
  await ensureRefundRequestsTable()

  const session = await auth()
  const username = session?.user?.username || null

  await db.update(refundRequests).set({
    status: 'rejected',
    adminUsername: username,
    adminNote: adminNote || null,
    updatedAt: new Date(),
  }).where(eq(refundRequests.id, requestId))

  revalidatePath('/admin/refunds')
}

