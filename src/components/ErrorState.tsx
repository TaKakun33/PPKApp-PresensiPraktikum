import { Button, Text, View } from "react-native";

type Props = { message?: string; onRetry?: () => void };

export default function ErrorState({ message = "Terjadi kesalahan. Periksa koneksi internet.", onRetry }: Props) {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }}>
      <Text style={{ marginBottom: 12, textAlign: "center" }}>{message}</Text>
      {onRetry && <Button title="Coba lagi" onPress={onRetry} />}
    </View>
  );
}