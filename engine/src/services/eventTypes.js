/**
 * Fonte única dos tipos de evento.
 *
 * A lista estava copiada em quatro arquivos (Events, EventCard,
 * CreateEventForm, EventDetails), cada um com os rótulos escritos em português
 * direto no código. Além de vazar para os 12 idiomas que herdam do inglês, era
 * o tipo de duplicação em que se acrescenta um tipo novo em três lugares e se
 * esquece do quarto.
 *
 * Aqui ficam só os valores — o que vai gravado no Firestore. O rótulo sai do
 * i18n em `events.types.<valor>`.
 */
export const EVENT_TYPE_VALUES = [
  "casual",
  "cars-and-coffee",
  "cruise",
  "concours",
  "drift",
  "track-day",
  "auto-meet",
  "autocross",
  "drag-racing",
  "rallye",
];

/** Rótulo traduzido de um tipo; cai no próprio valor se o tipo for desconhecido. */
export const eventTypeLabel = (t, value) =>
  t(`events.types.${value}`, { defaultValue: value });

/** Opções para <select>, já traduzidas. `withAll` acrescenta o "Todos" do filtro. */
export const eventTypeOptions = (t, { withAll = false } = {}) => [
  ...(withAll ? [{ value: "all", label: t("events.filters.all") }] : []),
  ...EVENT_TYPE_VALUES.map((value) => ({ value, label: eventTypeLabel(t, value) })),
];
