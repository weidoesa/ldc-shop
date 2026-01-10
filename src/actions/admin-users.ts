'use server'

import { checkAdmin } from "./admin"
import { updateUserPoints } from "@/lib/db/queries"
import { revalidatePath } from "next/cache"

export async function saveUserPoints(userId: string, points: number) {
    await checkAdmin()
    await updateUserPoints(userId, points)
    revalidatePath('/admin/users')
}

export async function toggleBlock(userId: string, isBlocked: boolean) {
    // Lazy import to avoid circular dependency if possible, but queries is fine
    const { toggleUserBlock } = await import("@/lib/db/queries")
    await checkAdmin()
    await toggleUserBlock(userId, isBlocked)
    revalidatePath('/admin/users')
}
