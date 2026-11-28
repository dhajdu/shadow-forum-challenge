import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { Banner, Button, Display, Eyebrow, Field, PageBanner, Small } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { config, isConfigured } from "@/lib/config";
import { supabase } from "@/lib/supabase";
import { color, heroH, space } from "@/theme/tokens";

// Sign in only. Members join, sign the Constitution and set their goal on the website first;
// the app opens straight onto Home.
export default function SignIn() {
  const { signIn, notice } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  async function submit() {
    setBusy(true);
    const error = await signIn(email, password);
    setMsg(error ? { text: error, ok: false } : null);
    setBusy(false);
  }

  async function forgot() {
    if (!email.includes("@")) return setMsg({ text: "Type your email first, then tap Forgot password.", ok: false });
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${config.apiBaseUrl}/auth/confirm?next=/reset-password`,
    });
    setBusy(false);
    setMsg(error ? { text: error.message, ok: false } : { text: "Check your email for a link to set a new password.", ok: true });
  }

  const ready = email.includes("@") && password.length > 0;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, backgroundColor: color.bg }}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 60 }}>
        <PageBanner image="landing" height={heroH} position="50% 35%">
          <Eyebrow tone={color.inkSoft}>By invitation only</Eyebrow>
          <Display size={60}>The Shadow Forum</Display>
          <Small tone={color.inkSoft}>Into the Shadow</Small>
        </PageBanner>
        <View style={{ paddingHorizontal: space.page, gap: 12, paddingTop: 8 }}>
          {notice ? <Banner tone={color.amber}>{notice}</Banner> : null}
          {!isConfigured() ? <Banner>Not configured: set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.</Banner> : null}
          <Field placeholder="Email" value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" textContentType="username" />
          <Field
            placeholder="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="current-password"
            textContentType="password"
            onSubmitEditing={ready ? submit : undefined}
          />
          {msg ? <Banner tone={msg.ok ? color.green : color.red}>{msg.text}</Banner> : null}
          <Button label="Enter" onPress={submit} busy={busy} disabled={!ready} />
          <Button ghost label="Forgot password" onPress={forgot} disabled={busy} />
          <Small style={{ textAlign: "center", marginTop: 6 }}>New member? Set up your account on the website first, from your invite.</Small>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
