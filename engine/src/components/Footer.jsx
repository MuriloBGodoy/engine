import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Apple, Play } from "lucide-react";
import {
  FaFacebookF,
  FaInstagram,
  FaLinkedinIn,
  FaTiktok,
  FaXTwitter,
  FaYoutube,
} from "react-icons/fa6";
import { LogoMark } from "./Logo";

/**
 * Rodapé global do Engine, no espírito dos grandes marketplaces automotivos.
 *
 * TODOS os links ficam centralizados aqui embaixo em LINKS — é só trocar o "#"
 * pela URL real quando cada página/rede/loja existir. Links internos que já
 * são rotas do app (ex.: "/settings") funcionam de imediato.
 */
const LINKS = {
  help: {
    center: "#", // TODO: central de ajuda
    contact: "#", // TODO: fale conosco / suporte
  },
  company: {
    about: "#", // TODO: página institucional "Sobre"
    careers: "#", // TODO: trabalhe com a gente / vagas
  },
  legal: {
    terms: "/termos",
    privacy: "/privacidade",
  },
  social: {
    linkedin: "#",
    facebook: "#",
    instagram: "#",
    tiktok: "#",
    x: "#",
    youtube: "#",
  },
  app: {
    googlePlay: "#", // TODO: link da Google Play
    appStore: "#", // TODO: link da App Store
  },
};

const SOCIAL = [
  { key: "linkedin", href: LINKS.social.linkedin, label: "LinkedIn", Icon: FaLinkedinIn },
  { key: "facebook", href: LINKS.social.facebook, label: "Facebook", Icon: FaFacebookF },
  { key: "instagram", href: LINKS.social.instagram, label: "Instagram", Icon: FaInstagram },
  { key: "tiktok", href: LINKS.social.tiktok, label: "TikTok", Icon: FaTiktok },
  { key: "x", href: LINKS.social.x, label: "X", Icon: FaXTwitter },
  { key: "youtube", href: LINKS.social.youtube, label: "YouTube", Icon: FaYoutube },
];

/** Aceita rota interna ("/x") como Link e URL externa/placeholder como <a>. */
function FooterLink({ href, children }) {
  const isInternal = href.startsWith("/");
  const className =
    "text-[13px] font-medium text-[var(--engine-text-muted)] transition-colors hover:text-[var(--engine-accent)]";
  if (isInternal) {
    return (
      <Link to={href} className={className}>
        {children}
      </Link>
    );
  }
  return (
    <a href={href} target={href === "#" ? undefined : "_blank"} rel="noreferrer" className={className}>
      {children}
    </a>
  );
}

function StoreBadge(props) {
  const { href, topLabel, brand, Icon } = props;
  return (
    <a
      href={href}
      target={href === "#" ? undefined : "_blank"}
      rel="noreferrer"
      className="flex h-12 items-center gap-2.5 rounded-xl border border-[var(--engine-border)] bg-[var(--engine-surface-2)] px-3.5 transition hover:border-[var(--engine-accent)]"
    >
      <Icon size={22} className="shrink-0 text-[var(--engine-text)]" />
      <span className="flex flex-col leading-none">
        <span className="text-[9px] font-medium uppercase tracking-wide text-[var(--engine-text-subtle)]">
          {topLabel}
        </span>
        <span className="mt-0.5 text-[13px] font-bold text-[var(--engine-text)]">{brand}</span>
      </span>
    </a>
  );
}

export function Footer() {
  const { t } = useTranslation();
  const year = new Date().getFullYear();

  const columns = [
    {
      title: t("footer.help.title"),
      items: [
        { label: t("footer.help.center"), href: LINKS.help.center },
        { label: t("footer.help.contact"), href: LINKS.help.contact },
      ],
    },
    {
      title: t("footer.company.title"),
      items: [
        { label: t("footer.company.about"), href: LINKS.company.about },
        { label: t("footer.company.careers"), href: LINKS.company.careers },
      ],
    },
    {
      title: t("footer.legal.title"),
      items: [
        { label: t("footer.legal.terms"), href: LINKS.legal.terms },
        { label: t("footer.legal.privacy"), href: LINKS.legal.privacy },
      ],
    },
  ];

  return (
    <footer className="mt-12 border-t border-[var(--engine-border)] pt-8">
      <div className="engine-container grid gap-8 pb-8 md:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))_minmax(0,1.2fr)]">
        {/* Marca + redes sociais */}
        <div>
          <div className="flex items-center gap-2.5">
            <LogoMark size={30} />
            <span className="font-display text-lg font-extrabold italic uppercase tracking-tight text-[var(--engine-text)]">
              Engine
            </span>
          </div>
          <p className="mt-3 max-w-xs text-[13px] leading-relaxed text-[var(--engine-text-muted)]">
            {t("footer.tagline")}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {SOCIAL.map((social) => {
              const { key, href, label, Icon } = social;
              return (
                <a
                  key={key}
                  href={href}
                  target={href === "#" ? undefined : "_blank"}
                  rel="noreferrer"
                  aria-label={label}
                  title={label}
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--engine-border)] text-[var(--engine-text-muted)] transition hover:border-[var(--engine-accent)] hover:text-[var(--engine-accent)]"
                >
                  <Icon size={16} />
                </a>
              );
            })}
          </div>
        </div>

        {/* Colunas de links */}
        {columns.map((column) => (
          <div key={column.title}>
            <h3 className="mb-3 text-[11px] font-black uppercase tracking-widest text-[var(--engine-text-subtle)]">
              {column.title}
            </h3>
            <ul className="space-y-2">
              {column.items.map((item) => (
                <li key={item.label}>
                  <FooterLink href={item.href}>{item.label}</FooterLink>
                </li>
              ))}
            </ul>
          </div>
        ))}

        {/* Baixe o app */}
        <div>
          <h3 className="mb-3 text-[11px] font-black uppercase tracking-widest text-[var(--engine-text-subtle)]">
            {t("footer.app.title")}
          </h3>
          <div className="flex flex-col gap-2.5">
            <StoreBadge
              href={LINKS.app.googlePlay}
              topLabel={t("footer.app.androidTop")}
              brand="Google Play"
              Icon={Play}
            />
            <StoreBadge
              href={LINKS.app.appStore}
              topLabel={t("footer.app.iosTop")}
              brand="App Store"
              Icon={Apple}
            />
          </div>
        </div>
      </div>

      {/* Barra de copyright */}
      <div className="border-t border-[var(--engine-border)] py-5">
        <div className="engine-container flex flex-col items-center justify-between gap-2 text-center sm:flex-row sm:text-left">
          <p className="text-[12px] font-medium text-[var(--engine-text-subtle)]">
            © {year} Engine Garage. {t("footer.rights")}
          </p>
          <p className="text-[12px] font-medium text-[var(--engine-text-subtle)]">
            {t("footer.madeWith")}
          </p>
        </div>
      </div>
    </footer>
  );
}
