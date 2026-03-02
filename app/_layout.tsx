import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { QuizProvider } from "@/providers/QuizProvider";
import Colors from "@/constants/colors";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RootLayoutNav() {
  return (
    <Stack
      screenOptions={{
        headerBackTitle: "Back",
        headerTintColor: Colors.primary,
        contentStyle: { backgroundColor: Colors.background },
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen
        name="upload"
        options={{ presentation: "modal", title: "Import Questions" }}
      />
      <Stack.Screen
        name="preview-editor"
        options={{ title: "Review Questions" }}
      />
      <Stack.Screen
        name="quiz-settings"
        options={{ title: "Quiz Settings" }}
      />
      <Stack.Screen
        name="quiz-player"
        options={{ headerShown: false, gestureEnabled: false }}
      />
      <Stack.Screen
        name="results"
        options={{ headerShown: false, gestureEnabled: false }}
      />
      <Stack.Screen
        name="review"
        options={{ title: "Review Answers" }}
      />
      <Stack.Screen
        name="edit-quiz"
        options={{ title: "Edit Quiz" }}
      />
    </Stack>
  );
}

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <GestureHandlerRootView>
        <QuizProvider>
          <RootLayoutNav />
        </QuizProvider>
      </GestureHandlerRootView>
    </QueryClientProvider>
  );
}
