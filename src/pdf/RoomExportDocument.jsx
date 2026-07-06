import { Document, Page, View, Text, Image, Svg, Rect, Link } from "@react-pdf/renderer";
import { styles } from "./pdfTheme";

// Pas de toLocaleString ni de symboles unicode (✓, €...) : la police de base
// utilisée par react-pdf ne les rend pas correctement (glyphes manquants).
function formatPrice(amount, currency) {
  if (typeof amount !== "number") return "";
  const rounded = Math.round(amount * 100) / 100;
  const [intPart, decPart] = rounded.toFixed(2).split(".");
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  const formatted = decPart === "00" ? grouped : `${grouped},${decPart}`;
  return `${formatted} ${currency || "EUR"}`;
}

function Swatch({ label, name, hex, small }) {
  return (
    <View style={small ? styles.swatchSmall : styles.swatch}>
      <View style={[small ? styles.swatchSmallBox : styles.swatchBox, { backgroundColor: hex || "#EEEEEE" }]} />
      <Text style={styles.swatchName}>{name || "—"}</Text>
      <Text style={styles.swatchLabel}>{label}</Text>
    </View>
  );
}

function ShoppingRow({ item }) {
  return (
    <View style={styles.tableRow}>
      {item.image ? <Image src={item.image} style={styles.tableThumb} /> : null}
      <View style={styles.tableCellText}>
        <Text>{item.text}</Text>
        {item.url ? <Link src={item.url} style={styles.tableCellUrl}>{item.url}</Link> : null}
      </View>
      <Text style={styles.tableCellPrice}>{formatPrice(item.price, item.priceCurrency)}</Text>
    </View>
  );
}

function Logo({ size = 20 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32">
      <Rect x="0" y="0" width="14" height="14" rx="2.5" fill="#b8c9d0" />
      <Rect x="18" y="0" width="14" height="14" rx="2.5" fill="#A8B5A2" />
      <Rect x="0" y="18" width="14" height="14" rx="2.5" fill="#D0AA6C" />
      <Rect x="18" y="18" width="14" height="14" rx="2.5" fill="#FAF6F0" />
    </Svg>
  );
}

export function RoomExportDocument({
  projectName,
  roomLabel,
  roomLine,
  generatedAt,
  apartmentPalette,
  palette,
  testColors = [],
  inspirationImages = [],
  materialImages = [],
  shoppingItems = [],
  budgetTotal,
  note,
  inviteUrl,
}) {
  const selectedItems = shoppingItems.filter((i) => i.selectedForPurchase);
  const wishlistItems = shoppingItems.filter((i) => !i.selectedForPurchase);

  return (
    <Document title={`${projectName || "Renoom"} — ${roomLabel}`}>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 }}>
            <Logo />
            <Text style={styles.brand}>Renoom — {projectName || "Projet"}</Text>
          </View>
          <Text style={styles.title}>{roomLabel}</Text>
          {roomLine ? <Text style={styles.subtitle}>{roomLine}</Text> : null}
          <Text style={styles.subtitle}>Généré le {generatedAt}</Text>
        </View>

        {apartmentPalette ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Palette de l'appartement</Text>
            <Text style={styles.caption}>Ambiance générale appliquée par défaut à toutes les pièces.</Text>
            <View style={styles.swatchRow}>
              <Swatch small label="Dominante" name={apartmentPalette?.dominant?.name} hex={apartmentPalette?.dominant?.hex} />
              <Swatch small label="Secondaire" name={apartmentPalette?.secondary?.name} hex={apartmentPalette?.secondary?.hex} />
              <Swatch small label="Sol" name={apartmentPalette?.sol?.name} hex={apartmentPalette?.sol?.hex} />
              {apartmentPalette?.accent ? (
                <Swatch small label="Accent" name={apartmentPalette.accent.name} hex={apartmentPalette.accent.hex} />
              ) : null}
            </View>
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Palette de la pièce — {roomLabel}</Text>
          <Text style={styles.caption}>Nuances propres à cette pièce (peuvent différer de l'appartement).</Text>
          <View style={styles.swatchRow}>
            <Swatch label="Dominante" name={palette?.dominant?.name} hex={palette?.dominant?.hex} />
            <Swatch label="Secondaire" name={palette?.secondary?.name} hex={palette?.secondary?.hex} />
            <Swatch label="Accent" name={palette?.accent?.name} hex={palette?.accent?.hex} />
          </View>
          {testColors.length > 0 && (
            <View style={{ marginTop: 12 }}>
              <Text style={styles.caption}>Couleurs testées</Text>
              <View style={[styles.swatchRow, { flexWrap: "wrap", marginTop: 6 }]}>
                {testColors.map((c) => (
                  <Swatch
                    key={c.id || c.hex}
                    label={c.chosen ? "Choisie" : ""}
                    name={`${c.name}${c.number ? ` N°${c.number}` : ""}`}
                    hex={c.hex}
                  />
                ))}
              </View>
            </View>
          )}
        </View>

        {inspirationImages.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Inspirations</Text>
            <View style={styles.imageGrid}>
              {inspirationImages.slice(0, 6).map((src) => (
                <Image key={src} src={src} style={styles.image} />
              ))}
            </View>
          </View>
        )}

        {materialImages.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Matériaux</Text>
            <View style={styles.imageGrid}>
              {materialImages.slice(0, 6).map((src) => (
                <Image key={src} src={src} style={styles.image} />
              ))}
            </View>
          </View>
        )}

        {shoppingItems.length > 0 && (
          <View style={styles.section} break>
            <Text style={styles.sectionTitle}>Liste de courses</Text>

            {selectedItems.length > 0 && (
              <View wrap={false}>
                <Text style={styles.subSectionTitle}>Sélectionné pour achat</Text>
                {selectedItems.map((item, i) => (
                  <ShoppingRow key={i} item={item} />
                ))}
                {budgetTotal ? (
                  <View style={styles.budgetBar}>
                    <Text style={styles.budgetLabel}>Total sélectionné pour achat</Text>
                    <Text style={styles.budgetValue}>{formatPrice(budgetTotal.amount, budgetTotal.currency)}</Text>
                  </View>
                ) : null}
              </View>
            )}

            {wishlistItems.length > 0 && (
              <View wrap={false}>
                <Text style={styles.subSectionTitle}>Envies (non sélectionnées)</Text>
                {wishlistItems.map((item, i) => (
                  <ShoppingRow key={i} item={item} />
                ))}
              </View>
            )}
          </View>
        )}

        {note && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Notes</Text>
            <Text style={styles.note}>{note}</Text>
          </View>
        )}

        <View style={styles.footer} fixed>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 3 }}>
            <Logo />
            <Text>Document généré depuis Renoom — {projectName || "Projet"} · {roomLabel}</Text>
          </View>
          <Link src={inviteUrl || "https://renoom.com"} style={{ color: "#8A6D3B" }}>
            {inviteUrl
              ? "Vous ne connaissez pas Renoom ? Rejoignez ce projet pour suivre les avancées"
              : "Vous ne connaissez pas Renoom ? Découvrez l'app sur renoom.com"}
          </Link>
        </View>
      </Page>
    </Document>
  );
}
