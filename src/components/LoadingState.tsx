import { ActivityIndicator, Text, View } from "react-native";

export default function LoadingState({ message = "Memuat data..." }: { message?: string }) {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }}>
      <ActivityIndicator size="large" />
      <Text style={{ marginTop: 12 }}>{message}</Text>
    </View>
  );
}