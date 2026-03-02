import { Stack } from "expo-router";
import React from "react";
import Colors from "@/constants/colors";

export default function AILayout() {
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
        options={{ title: "AI Assistant" }}
      />
    </Stack>
  );
}
