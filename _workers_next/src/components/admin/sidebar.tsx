'use client'

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Package, CreditCard, LogOut, Megaphone, Star, Download, Tags, RotateCcw, Users, Settings, QrCode, Bell } from "lucide-react"
import { useI18n } from "@/lib/i18n/context"
import { signOut } from "next-auth/react"

export function AdminSidebar({ username }: { username: string }) {
    const { t } = useI18n()

    return (
        <aside className="w-full md:w-64 bg-muted/40 border-r md:min-h-screen p-6 space-y-4">
            <div className="flex items-center gap-2 font-bold text-xl px-2 mb-6">
                <span>{t('common.adminTitle')}</span>
            </div>
            <nav className="flex flex-col gap-2">
                <Button variant="ghost" asChild className="justify-start">
                    <Link href="/admin/settings"><Settings className="mr-2 h-4 w-4" />{t('common.storeSettings')}</Link>
                </Button>
                <Button variant="ghost" asChild className="justify-start">
                    <Link href="/admin/products"><Package className="mr-2 h-4 w-4" />{t('common.productManagement')}</Link>
                </Button>
                <Button variant="ghost" asChild className="justify-start">
                    <Link href="/admin/orders"><CreditCard className="mr-2 h-4 w-4" />{t('common.ordersRefunds')}</Link>
                </Button>
                <Button variant="ghost" asChild className="justify-start">
                    <Link href="/admin/refunds"><RotateCcw className="mr-2 h-4 w-4" />{t('common.refundRequests')}</Link>
                </Button>
                <Button variant="ghost" asChild className="justify-start">
                    <Link href="/admin/categories"><Tags className="mr-2 h-4 w-4" />{t('common.categoriesManage')}</Link>
                </Button>
                <Button variant="ghost" asChild className="justify-start">
                    <Link href="/admin/users"><Users className="mr-2 h-4 w-4" />{t('common.customers')}</Link>
                </Button>
                <Button variant="ghost" asChild className="justify-start">
                    <Link href="/admin/reviews"><Star className="mr-2 h-4 w-4" />{t('common.reviews')}</Link>
                </Button>
                <Button variant="ghost" asChild className="justify-start">
                    <Link href="/admin/announcement"><Megaphone className="mr-2 h-4 w-4" />{t('announcement.title')}</Link>
                </Button>
                <Button variant="ghost" asChild className="justify-start">
                    <Link href="/admin/data"><Download className="mr-2 h-4 w-4" />{t('common.dataExport')}</Link>
                </Button>
                <Button variant="ghost" asChild className="justify-start">
                    <Link href="/admin/collect"><QrCode className="mr-2 h-4 w-4" />{t('payment.adminMenu')}</Link>
                </Button>
                <Button variant="ghost" asChild className="justify-start">
                    <Link href="/admin/notifications"><Bell className="mr-2 h-4 w-4" />{t('admin.settings.notifications.title')}</Link>
                </Button>
            </nav>
            <div className="mt-auto pt-6 border-t">
                <div className="px-2 text-sm text-muted-foreground mb-4">
                    {t('common.loggedInAs')} <br /> <strong className="text-foreground">{username}</strong>
                </div>
                <Button
                    variant="outline"
                    className="w-full justify-start text-muted-foreground"
                    onClick={() => signOut({ callbackUrl: "/" })}
                >
                    <LogOut className="mr-2 h-4 w-4" />{t('common.logout')}
                </Button>
            </div>
        </aside>
    )
}
