import { Image, Text, View } from "react-native";
import { color, fs } from "@/theme/tokens";

export function Avatar({ name, url, size = 48 }: { name: string; url: string | null; size?: number }) {
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("");
  if (url) return <Image source={{ uri: url }} style={{ width: size, height: size, borderRadius: size / 2 }} accessibilityIgnoresInvertColors />;
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color.avatarFrom, borderColor: color.line, borderWidth: 1, alignItems: "center", justifyContent: "center" }}>
      <Text style={{ color: color.inkSoft, fontWeight: "800", fontSize: size > 40 ? fs.lg : fs.sm }}>{initials}</Text>
    </View>
  );
}
