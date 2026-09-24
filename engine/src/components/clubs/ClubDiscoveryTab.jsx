import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Search, Loader2, Plus } from "lucide-react";
import { ClubCard } from "./ClubCard";
import { useDiscoverClubs } from "./clubsDataSource";
import { CLUB_STYLE_VALUES, clubStyleLabel } from "../../services/clubStyles";

/** Uma seção só aparece quando tem conteúdo — seção vazia não ocupa espaço. */
function Section({ title, hint, clubs, onOpen, onJoined }) {
  if (!clubs?.length) return null;
  return (
    <section className="space-y-2.5">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-[15px] font-extrabold tracking-tight text-[var(--engine-text)]">
          {title}
        </h3>
        {hint ? (
          <span className="text-[12px] text-[var(--engine-text-muted)]">{hint}</span>
        ) : null}
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {clubs.map((club) => (
          <ClubCard key={club.id} club={club} onOpen={onOpen} onJoined={onJoined} />
        ))}
      </div>
    </section>
  );
}

/**
 * A descoberta, nas quatro seções do contrato (§3): pro seu carro, em alta,
 * perto de você, todos.
 *
 * O anti-tela-vazia é a regra que vem da região (memória
 * `engine-regiao-localidade`): quando a soma de tudo dá menos de três clubes,
 * a tela oferece fundar em vez de mostrar uma grade magra — "muito poucos
 * clubes" era metade da reclamação original.
 */
export function ClubDiscoveryTab({ onSelectClub, onCreate }) {
  const { t } = useTranslation();
  const { sections, loading, error, fetch } = useDiscoverClubs();
  const [style, setStyle] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch({ style, search });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [style]);

  const total = useMemo(
    () =>
      ["forYourCar", "trending", "nearby", "all"].reduce(
        (sum, key) => sum + (sections?.[key]?.length || 0),
        0,
      ),
    [sections],
  );

  const sectionProps = {
    onOpen: onSelectClub,
    onJoined: () => fetch({ style, search }),
  };

  return (
    <div className="space-y-5">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          fetch({ style, search });
        }}
        className="relative"
      >
        <Search
          size={17}
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--engine-text-muted)]"
        />
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t("clubs.filters.searchPlaceholder")}
          className="min-h-11 w-full rounded-xl border border-[var(--engine-border)] bg-[var(--engine-surface-2)] py-2.5 pl-10 pr-3 text-base text-[var(--engine-text)] outline-none transition-colors focus:border-[var(--engine-accent)]"
        />
      </form>

      {/* Faixa rolável: 17 estilos não cabem numa linha de celular, e quebrar
          em várias linhas empurraria os clubes para fora da primeira tela. */}
      <div className="engine-chip-scroll -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {["", ...CLUB_STYLE_VALUES].map((value) => (
          <button
            key={value || "all"}
            type="button"
            onClick={() => setStyle(value)}
            aria-pressed={style === value}
            className={`min-h-10 shrink-0 rounded-full border px-3.5 text-[12.5px] font-semibold transition-colors ${
              style === value
                ? "border-[var(--engine-accent)] bg-[var(--engine-accent-soft)] text-[var(--engine-accent)]"
                : "border-[var(--engine-border-strong)] bg-[var(--engine-surface)] text-[var(--engine-text)] hover:border-[var(--engine-text)]"
            }`}
          >
            {value ? clubStyleLabel(t, value) : t("clubs.filters.allStyles")}
          </button>
        ))}
      </div>

      {error ? (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}

      {loading && !total ? (
        <div className="flex items-center justify-center gap-2 py-12 text-[var(--engine-text-muted)]">
          <Loader2 size={18} className="animate-spin" />
          {t("clubs.loading")}
        </div>
      ) : (
        <>
          <Section
            title={t("clubs.sections.forYourCar")}
            hint={t("clubs.sections.forYourCarHint")}
            clubs={sections?.forYourCar}
            {...sectionProps}
          />
          <Section
            title={t("clubs.sections.trending")}
            hint={t("clubs.sections.trendingHint")}
            clubs={sections?.trending}
            {...sectionProps}
          />
          <Section
            title={t("clubs.sections.nearby")}
            clubs={sections?.nearby}
            {...sectionProps}
          />
          <Section title={t("clubs.sections.all")} clubs={sections?.all} {...sectionProps} />

          {total < 3 ? (
            <div className="rounded-2xl border border-dashed border-[var(--engine-border-strong)] px-4 py-6 text-center">
              <p className="text-[14px] font-bold text-[var(--engine-text)]">
                {total === 0 ? t("clubs.found.none") : t("clubs.found.fewTitle")}
              </p>
              <p className="mx-auto mt-1 max-w-[42ch] text-[12.5px] leading-relaxed text-[var(--engine-text-muted)]">
                {t("clubs.found.fewCopy")}
              </p>
              <button
                type="button"
                onClick={onCreate}
                className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--engine-accent)] px-4 text-[14px] font-bold text-white transition hover:opacity-90"
              >
                <Plus size={17} />
                {t("clubs.found.foundFirst")}
              </button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
