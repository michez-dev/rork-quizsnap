import { Stack } from "expo-router";
import { View, StyleSheet } from "react-native";
import Colors from "@/constants/colors";

export default function ModalScreen() {
  return (
    <>
      <Stack.Screen options={{ presentation: "modal" }} />
      <View style={styles.container} />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
});
