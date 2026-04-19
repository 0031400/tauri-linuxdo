import { Alert, Button, Card, CardContent, CircularProgress } from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  fetchAllTopicCategories,
  syncLinuxDoSession,
} from "../api/linuxdo";
import type { TopicCategory } from "../types/topic";
import { getPlatformCapabilities } from "../utils/platform";

function buildCategoryPathMap(categories: TopicCategory[]) {
  const categoryById = new Map<number, TopicCategory>();
  for (const category of categories) {
    categoryById.set(category.id, category);
  }

  const pathById = new Map<number, string>();
  for (const category of categories) {
    const parentId = category.parent_category_id;
    if (parentId) {
      const parent = categoryById.get(parentId);
      if (parent?.slug) {
        pathById.set(category.id, `${parent.slug}/${category.slug}`);
        continue;
      }
    }
    pathById.set(category.id, category.slug);
  }
  return pathById;
}

export function CategoriesPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isMobile } = getPlatformCapabilities();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [authed, setAuthed] = useState(false);
  const [categories, setCategories] = useState<TopicCategory[]>([]);
  const [parentNameById, setParentNameById] = useState<Map<number, string>>(new Map());

  useEffect(() => {
    void (async () => {
      setLoading(true);
      setError("");
      try {
        const session = await syncLinuxDoSession("categories bootstrap");
        setAuthed(session.loggedIn);
        if (!session.loggedIn) {
          setCategories([]);
          return;
        }

        const all = await fetchAllTopicCategories();
        setCategories(all);

        const nameById = new Map(all.map((item) => [item.id, item.name] as const));
        const nextParentNameById = new Map<number, string>();
        for (const item of all) {
          if (!item.parent_category_id) continue;
          nextParentNameById.set(item.id, nameById.get(item.parent_category_id) ?? "");
        }
        setParentNameById(nextParentNameById);
      } catch (err) {
        console.error(err);
        setError("Failed to load categories. Please try again.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const pathById = useMemo(() => buildCategoryPathMap(categories), [categories]);
  const selectedCategory = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get("selected")?.trim() ?? "";
  }, [location.search]);

  return (
    <div className={isMobile ? "min-h-[calc(100vh-6rem)]" : "mx-auto max-w-[760px] py-6"}>
      <Card className="rounded-[28px] border border-slate-200/80 bg-white/95 shadow-lg shadow-slate-200/70">
        <CardContent className={isMobile ? "space-y-3 p-3" : "space-y-4 p-6"}>
          <div className="flex items-center justify-between gap-3">
            <div className="text-xl font-semibold tracking-tight text-slate-900">Categories</div>
            <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500">
              {categories.length}
            </div>
          </div>

          {loading ? (
            <div className="flex h-36 items-center justify-center">
              <CircularProgress size={24} />
            </div>
          ) : error ? (
            <Alert severity="error">{error}</Alert>
          ) : !authed ? (
            <Alert severity="info">请先登录</Alert>
          ) : (
            <div className="space-y-2">
              <button
                type="button"
                className={[
                  "w-full rounded-2xl border px-4 py-3 text-left text-sm transition",
                  !selectedCategory
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-200 bg-white hover:border-slate-300",
                ].join(" ")}
                onClick={() => navigate("/home")}
              >
                All Categories
              </button>

              <div className="max-h-[60vh] space-y-2 overflow-y-auto pr-1">
                {categories.map((category) => {
                  const path = pathById.get(category.id) ?? category.slug;
                  const isActive = selectedCategory === path;
                  const parentName = parentNameById.get(category.id)?.trim();
                  return (
                    <button
                      key={category.id}
                      type="button"
                      className={[
                        "w-full rounded-2xl border px-4 py-3 text-left text-sm transition-all duration-200",
                        isActive
                          ? "border-slate-900 bg-slate-900 text-white shadow-sm shadow-slate-300"
                          : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50",
                      ].join(" ")}
                      onClick={() => navigate(`/home?category=${encodeURIComponent(path)}`)}
                    >
                      <div className="font-medium tracking-tight">{category.name}</div>
                      <div className={["text-xs", isActive ? "text-slate-200" : "text-slate-400"].join(" ")}>
                        {parentName ? `Parent: ${parentName}` : "Top-level category"}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {!loading && !error && !authed ? (
            <Button variant="contained" fullWidth className="h-11 rounded-xl" onClick={() => navigate("/profile")}>
              前往登录
            </Button>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
