import { StyleSheet } from "@react-pdf/renderer";

export const colors = {
  ink: "#1C1A17",
  muted: "#6B6660",
  border: "#E4DCC9",
  accentBg: "#FBF6EC",
  accentText: "#8A6D3B",
  cream: "#FDF9F4",
};

export const styles = StyleSheet.create({
  page: {
    padding: 32,
    fontSize: 10,
    color: colors.ink,
    fontFamily: "Helvetica",
  },
  header: {
    marginBottom: 20,
    paddingBottom: 12,
    borderBottom: `1px solid ${colors.border}`,
  },
  brand: {
    fontSize: 9,
    color: colors.muted,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: 700,
  },
  subtitle: {
    fontSize: 10,
    color: colors.muted,
    marginTop: 2,
  },
  section: {
    marginBottom: 18,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    color: colors.muted,
    marginBottom: 8,
  },
  swatchRow: {
    flexDirection: "row",
    gap: 12,
  },
  swatch: {
    flexDirection: "column",
    alignItems: "center",
    width: 90,
  },
  swatchBox: {
    width: 48,
    height: 48,
    borderRadius: 6,
    border: `1px solid ${colors.border}`,
    marginBottom: 4,
  },
  swatchLabel: {
    fontSize: 8,
    color: colors.muted,
    textAlign: "center",
  },
  swatchName: {
    fontSize: 9,
    fontWeight: 700,
    textAlign: "center",
  },
  imageGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  image: {
    width: 120,
    height: 90,
    borderRadius: 4,
    objectFit: "cover",
  },
  subSectionTitle: {
    fontSize: 9,
    fontWeight: 700,
    color: colors.ink,
    marginTop: 10,
    marginBottom: 6,
  },
  tableRow: {
    flexDirection: "row",
    alignItems: "center",
    borderBottom: `1px solid ${colors.border}`,
    paddingVertical: 6,
  },
  tableThumb: {
    width: 28,
    height: 28,
    borderRadius: 4,
    marginRight: 8,
    objectFit: "cover",
  },
  tableCellText: {
    flex: 1,
  },
  tableCellPrice: {
    width: 70,
    textAlign: "right",
  },
  swatchSmallBox: {
    width: 32,
    height: 32,
    borderRadius: 5,
    border: `1px solid ${colors.border}`,
    marginBottom: 4,
  },
  swatchSmall: {
    flexDirection: "column",
    alignItems: "center",
    width: 70,
  },
  budgetBar: {
    marginTop: 8,
    padding: 10,
    backgroundColor: colors.accentBg,
    borderRadius: 6,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  budgetLabel: {
    fontSize: 10,
    color: colors.accentText,
  },
  budgetValue: {
    fontSize: 12,
    fontWeight: 700,
    color: colors.accentText,
  },
  note: {
    fontSize: 10,
    lineHeight: 1.5,
    color: colors.ink,
  },
  empty: {
    fontSize: 9,
    color: colors.muted,
    fontStyle: "italic",
  },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 32,
    right: 32,
    flexDirection: "column",
    alignItems: "center",
    fontSize: 8,
    color: colors.muted,
    borderTop: `1px solid ${colors.border}`,
    paddingTop: 8,
  },
});
