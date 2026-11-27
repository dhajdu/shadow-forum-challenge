import { useState } from "react";
import { KeyboardAvoidingView, Platform, Text, View } from "react-native";
import { Banner, Body, Button, Eyebrow, Field, Screen, Seg } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { config, isConfigured } from "@/lib/config";
import * as WebBrowser from "expo-web-browser";
import { color, fs } from "@/theme/tokens";

type Mode = "in" | "up";

export default function SignIn() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<Mode>("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(mode === "in" ? await signIn(email, password) : await signUp({ code, name, email, password }));
    setBusy(false);
  }

  const ready = email.includes("@") && password.length >= (mode === "up" ? 8 : 1) && (mode === "in" || (name.trim() && code.trim()));

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ gap: 16, paddingTop: 48 }}>
        <Eyebrow tone={color.ink}>THE SHADOW FORUM</Eyebrow>
        <Text style={{ fontSize: fs.xl3, fontWeight: "800", color: color.ink }}>{mode === "in" ? "Sign in" : "Create your account"}</Text>
        <Body muted>Members only. {mode === "in" ? "Use the email and password you use on the website." : "You need the access code from Dave."}</Body>
        <Seg options={[{ key: "in", label: "Sign in" }, { key: "up", label: "I have a code" }] as const} value={mode} onChange={(m) => { setMode(m); setError(null); }} />
        {!isConfigured() ? <Banner>Not configured: set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.</Banner> : null}
        <View style={{ gap: 12 }}>
          {mode === "up" ? (
            <>
              <Field label="Access code" value={code} onChangeText={setCode} autoCapitalize="none" autoCorrect={false} />
              <Field label="Your name" value={name} onChangeText={setName} autoComplete="name" textContentType="name" />
            </>
          ) : null}
          <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" textContentType="username" />
          <Field
            label={mode === "up" ? "Password (8+ characters)" : "Password"}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete={mode === "in" ? "current-password" : "new-password"}
            textContentType={mode === "in" ? "password" : "newPassword"}
            onSubmitEditing={ready ? submit : undefined}
          />
        </View>
        {error ? <Banner tone={color.red}>{error}</Banner> : null}
        <Button label={mode === "in" ? "Sign in" : "Create account"} onPress={submit} busy={busy} disabled={!ready} />
        {mode === "in" ? (
          <Button ghost label="Forgot password" onPress={() => WebBrowser.openBrowserAsync(`${config.apiBaseUrl}/reset-password`)} />
        ) : null}
      </KeyboardAvoidingView>
    </Screen>
  );
}
