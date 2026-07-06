import { Document, Page, View, Text, Image } from "@react-pdf/renderer";
import { styles } from "./pdfTheme";

function formatPrice(amount, currency) {
  if (typeof amount !== "number") return "";
  return `${amount.toLocaleString("fr-FR")}${currency ? ` ${currency}` : "€"}`;
}

function Swatch({ label, name, hex }) {
  return (
    <View style={styles.swatch}>
      <View style={[styles.swatchBox, { backgroundColor: hex || "#EEEEEE" }]} />
      <Text style={styles.swatchName}>{name || "—"}</Text>
      <Text style={styles.swatchLabel}>{label}</Text>
    </View>
  );
}

export function RoomExportDocument({
  projectName,
  roomLabel,
  roomLine,
  generatedAt,
  palette,
  testColors = [],
  inspirationImages = [],
  shoppingItems = [],
  budgetTotal,
  note,
}) {
  return (
    <Document title={`${projectName || "Renoom"} — ${roomLabel}`}>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.brand}>Renoom — {projectName || "Projet"}</Text>
          <Text style={styles.title}>{roomLabel}</Text>
          {roomLine ? <Text style={styles.subtitle}>{roomLine}</Text> : null}
          <Text style={styles.subtitle}>Généré le {generatedAt}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Palette</Text>
          <View style={styles.swatchRow}>
            <Swatch label="Dominante" name={palette?.dominant?.name} hex={palette?.dominant?.hex} />
            <Swatch label="Secondaire" name={palette?.secondary?.name} hex={palette?.secondary?.hex} />
            <Swatch label="Accent" name={palette?.accent?.name} hex={palette?.accent?.hex} />
          </View>
          {testColors.length > 0 && (
            <View style={{ marginTop: 12 }}>
              <Text style={styles.swatchLabel}>Couleurs testées</Text>
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

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Inspirations</Text>
          {inspirationImages.length > 0 ? (
            <View style={styles.imageGrid}>
              {inspirationImages.slice(0, 6).map((src) => (
                <Image key={src} src={src} style={styles.image} />
              ))}
            </View>
          ) : (
            <Text style={styles.empty}>Aucune inspiration ajoutée pour cette pièce.</Text>
          )}
        </View>

        <View style={styles.section} wrap={false}>
          <Text style={styles.sectionTitle}>Liste de courses</Text>
          {shoppingItems.length > 0 ? (
            <View>
              {shoppingItems.map((item, i) => (
                <View key={i} style={styles.tableRow}>
                  <Text style={styles.tableCellText}>
                    {item.selectedForPurchase ? "✓ " : "· "}
                    {item.text}
                  </Text>
                  <Text style={styles.tableCellPrice}>{formatPrice(item.price, item.priceCurrency)}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.empty}>Aucun article dans la liste de courses.</Text>
          )}
          {budgetTotal ? (
            <View style={styles.budgetBar}>
              <Text style={styles.budgetLabel}>Total sélectionné pour achat</Text>
              <Text style={styles.budgetValue}>{formatPrice(budgetTotal.amount, budgetTotal.currency)}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notes</Text>
          <Text style={note ? styles.note : styles.empty}>{note || "Aucune note pour cette pièce."}</Text>
        </View>

        <Text style={styles.footer} fixed>
          Document généré depuis Renoom — {projectName || "Projet"} · {roomLabel}
        </Text>
      </Page>
    </Document>
  );
}
