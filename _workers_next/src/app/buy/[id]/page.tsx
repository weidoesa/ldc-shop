import { notFound } from "next/navigation"
import { auth } from "@/lib/auth"
import { BuyContent } from "@/components/buy-content"
import { BuyRestricted } from "@/components/buy-restricted"
import { cancelExpiredOrders, cleanupExpiredCardsIfNeeded, getProduct, getProductReviews, getProductRating, canUserReview, getProductVisibility, getLiveCardStats } from "@/lib/db/queries"
import { getEmailSettings } from "@/lib/email"
import { cacheLife, cacheTag } from "next/cache"
import { INFINITE_STOCK } from "@/lib/constants"

interface BuyPageProps {
    params: Promise<{ id: string }>
}

const TAG_PRODUCTS = "home:products"
const TAG_RATINGS = "home:ratings"

export default async function BuyPage({ params }: BuyPageProps) {
    const { id } = await params
    const session = await auth()
    const isLoggedIn = !!session?.user
    const trustLevel = Number.isFinite(Number(session?.user?.trustLevel)) ? Number(session?.user?.trustLevel) : 0

    const getCachedProduct = async (loggedIn: boolean, level: number | null) => {
        'use cache'
        cacheTag(TAG_PRODUCTS)
        cacheLife('days')
        return getProduct(id, { isLoggedIn: loggedIn, trustLevel: level })
    }

    const getCachedReviews = async () => {
        'use cache'
        cacheTag(TAG_RATINGS)
        cacheLife('days')
        return getProductReviews(id)
    }

    try {
        await cleanupExpiredCardsIfNeeded(undefined, id)
        // Ensure expired reservations are released when visiting the product page
        await cancelExpiredOrders({ productId: id })
    } catch {
        // best effort
    }

    // Run all queries in parallel for better performance
    const [product, reviews, emailSettings] = await Promise.all([
        getCachedProduct(isLoggedIn, trustLevel).catch(() => null),
        getCachedReviews().catch(() => []),
        getEmailSettings().catch(() => ({ apiKey: null, fromEmail: null, enabled: false, fromName: null }))
    ])

    // Return 404 if product doesn't exist or is inactive
    if (!product) {
        const visibility = await getProductVisibility(id).catch(() => null)
        if (!visibility || visibility.isActive === false) {
            notFound()
        }
        const requiredLevel = Number.isFinite(Number(visibility.visibilityLevel))
            ? Number(visibility.visibilityLevel)
            : -1
        if (requiredLevel < 0) {
            notFound()
        }
        return <BuyRestricted requiredLevel={requiredLevel} isLoggedIn={isLoggedIn} />
    }

    // Check review eligibility (depends on session, so run after)
    let userCanReview: { canReview: boolean; orderId?: string } = { canReview: false }
    if (session?.user?.id) {
        try {
            userCanReview = await canUserReview(session.user.id, id, session.user.username || undefined)
        } catch {
            // Ignore errors
        }
    }

    const liveStats = product ? await getLiveCardStats([product.id]).catch(() => new Map()) : new Map()
    const stat = product ? liveStats.get(product.id) : undefined
    const liveAvailable = product
        ? (product.isShared
            ? ((stat?.unused || 0) > 0 ? INFINITE_STOCK : 0)
            : (stat?.available ?? product.stock ?? 0))
        : 0
    const liveLocked = stat?.locked ?? product?.locked ?? 0

    return (
        <BuyContent
            product={product}
            stockCount={liveAvailable}
            lockedStockCount={liveLocked}
            isLoggedIn={!!session?.user}
            reviews={reviews}
            averageRating={Number(product.rating || 0)}
            reviewCount={Number(product.reviewCount || 0)}
            canReview={userCanReview.canReview}
            reviewOrderId={userCanReview.orderId}
            emailEnabled={!!(emailSettings?.enabled && emailSettings?.apiKey && emailSettings?.fromEmail)}
        />
    )
}
