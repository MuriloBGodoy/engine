import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

export function Home() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    /* Ajustado o padding-top (pt-6) para dar um respiro em relação à Topbar global */
    <div className="flex min-h-[75vh] flex-col items-center justify-center text-center pt-6">
      <h1 className="mb-4 text-6xl font-black uppercase italic tracking-tight text-slate-950 dark:text-white">
        Engine{" "}
        <span className="text-red-600 underline decoration-red-600/30">
          Garage
        </span>
      </h1>
      <p className="mb-10 max-w-md font-medium text-gray-500 dark:text-gray-400">
        {t("home.subtitle")}
      </p>
      <button
        onClick={() => navigate("/garagem")}
        className="rounded-xl bg-red-600 px-10 py-4 font-black uppercase italic text-white shadow-[0_0_30px_rgba(220,38,38,0.4)] transition-all hover:scale-105 hover:bg-red-700"
      >
        {t("home.cta")}
      </button>

      <div className="mt-20 grid grid-cols-3 gap-8 text-[10px] font-bold uppercase italic tracking-[0.3em] opacity-50">
        <span>{t("home.select")}</span>
        <span>{t("home.track")}</span>
        <span>{t("home.conquer")}</span>
      </div>
    </div>
  );
}
