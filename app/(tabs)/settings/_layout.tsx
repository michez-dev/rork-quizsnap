import { Stack } from "expo-router";
import React from "react";
import Colors from "@/constants/colors";

export default function SettingsLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: Colors.surface },
        headerTintColor: Colors.text,
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen
        name="index"
        options={{ title: "Settings" }}
      />
    </Stack>
  );
}
