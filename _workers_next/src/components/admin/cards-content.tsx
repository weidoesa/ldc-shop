'use client'

import { useI18n } from "@/lib/i18n/context"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { addCards, deleteCard, deleteCards } from "@/actions/admin"
import { Checkbox } from "@/components/ui/checkbox"
import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { CopyButton } from "@/components/copy-button"
import { Trash2 } from "lucide-react"
import { useRouter } from "next/navigation"

interface CardData {
    id: number
    cardKey: string
}

interface CardsContentProps {
    productId: string
    productName: string
    unusedCards: CardData[]
}

export function CardsContent({ productId, productName, unusedCards }: CardsContentProps) {
    const { t } = useI18n()
    const router = useRouter()
    const [selectedIds, setSelectedIds] = useState<number[]>([])

    const toggleSelectAll = () => {
        if (selectedIds.length === unusedCards.length) {
            setSelectedIds([])
        } else {
            setSelectedIds(unusedCards.map(c => c.id))
        }
    }

    const toggleSelect = (id: number) => {
        setSelectedIds(prev =>
            prev.includes(id)
                ? prev.filter(pid => pid !== id)
                : [...prev, id]
        )
    }

    const handleBatchDelete = async () => {
        if (!selectedIds.length) return

        if (confirm(t('admin.cards.confirmBatchDelete', { count: selectedIds.length }))) {
            try {
                await deleteCards(selectedIds)
                toast.success(t('common.success'))
                setSelectedIds([])
                router.refresh()
            } catch (e: any) {
                toast.error(e.message)
            }
        }
    }

    const handleSubmit = async (formData: FormData) => {
        try {
            await addCards(formData)
            toast.success(t('common.success'))
            router.refresh()
        } catch (e: any) {
            toast.error(e.message)
        }
    }

    return (
        <div className="space-y-8 max-w-4xl mx-auto">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">{t('admin.cards.title')}: {productName}</h1>
                </div>
                <div className="text-right">
                    <div className="text-2xl font-bold">{unusedCards.length}</div>
                    <div className="text-xs text-muted-foreground">{t('admin.cards.available')}</div>
                </div>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
                <Card>
                    <CardHeader>
                        <CardTitle>{t('admin.cards.addCards')}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <form action={handleSubmit} className="space-y-4">
                            <input type="hidden" name="product_id" value={productId} />
                            <Textarea name="cards" placeholder={t('admin.cards.placeholder')} rows={10} className="font-mono text-sm" required />
                            <Button type="submit" className="w-full">{t('common.add')}</Button>
                        </form>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>{t('admin.cards.available')}</CardTitle>
                    </CardHeader>
                    <CardContent className="max-h-[400px] overflow-y-auto space-y-2">
                        {unusedCards.length > 0 && (
                            <div className="flex items-center justify-between pb-2 mb-2 border-b sticky top-0 bg-background z-10">
                                <div className="flex items-center gap-2">
                                    <Checkbox
                                        checked={selectedIds.length === unusedCards.length && unusedCards.length > 0}
                                        onCheckedChange={toggleSelectAll}
                                        id="select-all"
                                    />
                                    <label htmlFor="select-all" className="text-sm cursor-pointer select-none">
                                        {t('admin.cards.selectAll')}
                                        {selectedIds.length > 0 && <span className="ml-2 text-muted-foreground text-xs">({t('admin.cards.selectedCount', { count: selectedIds.length })})</span>}
                                    </label>
                                </div>
                                {selectedIds.length > 0 && (
                                    <Button
                                        variant="destructive"
                                        size="sm"
                                        className="h-7 text-xs"
                                        onClick={handleBatchDelete}
                                    >
                                        {t('admin.cards.batchDelete')}
                                    </Button>
                                )}
                            </div>
                        )}
                        {unusedCards.length === 0 ? (
                            <div className="text-center py-10 text-muted-foreground text-sm">{t('admin.cards.noCards')}</div>
                        ) : (
                            unusedCards.map(c => (
                                <div key={c.id} className="flex items-center justify-between p-2 rounded bg-muted/40 text-sm font-mono gap-2 animate-in fade-in transition-colors hover:bg-muted/60">
                                    <div className="flex items-center gap-3">
                                        <Checkbox
                                            checked={selectedIds.includes(c.id)}
                                            onCheckedChange={() => toggleSelect(c.id)}
                                        />
                                        <CopyButton text={c.cardKey} truncate maxLength={30} />
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                                        onClick={async () => {
                                            if (confirm(t('common.confirm') + '?')) {
                                                try {
                                                    await deleteCard(c.id)
                                                    toast.success(t('common.success'))
                                                    router.refresh()
                                                } catch (e: any) {
                                                    toast.error(e.message)
                                                }
                                            }
                                        }}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            ))
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
