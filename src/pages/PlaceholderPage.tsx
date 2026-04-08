import { Card, CardContent } from "@mui/material";

export function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="flex h-full min-h-[calc(100vh-3rem)] items-center justify-center">
      <Card className="w-full rounded-[28px] border border-slate-200 shadow-lg shadow-slate-200/70">
        <CardContent className="p-10">
          <div className="space-y-3">
            <div className="text-sm font-medium text-slate-500">占位页面</div>
            <div className="text-3xl font-semibold text-slate-900">{title}</div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
