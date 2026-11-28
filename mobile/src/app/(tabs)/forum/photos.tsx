import { File, Paths } from "expo-file-system";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import * as Sharing from "expo-sharing";
import { useMemo, useState } from "react";
import { FlatList, Modal, Pressable, Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { today } from "@shared/contest";
import { meetingTitle } from "@shared/forum";
import { ForumScreen } from "@/components/ForumScreen";
import { Banner, Button, Empty, Eyebrow, Loading, Row, Seg, Small } from "@/components/ui";
import * as data from "@/data";
import type { Photo, PickedPhoto } from "@/data";
import { long, short } from "@/lib/format";
import { useLoad } from "@/lib/useLoad";
import { color, font, fs, radius, space } from "@/theme/tokens";

type Group = { key: string; title: string; photos: Photo[] };

// /forum/photos — the forum's photos, grouped per forum (or month). Add photos opens the photo
// picker; each upload is tagged to a forum the member can see. The database decides what shows.
export default function Photos() {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { data: d, error, loading, reload } = useLoad(async () => {
    const [ph, list] = await Promise.all([data.photos(), data.forums()]);
    return { ph, list };
  });
  const [by, setBy] = useState<"forum" | "month">("forum");
  const [open, setOpen] = useState<number | null>(null);
  const [picked, setPicked] = useState<PickedPhoto[] | null>(null);

  const groups = useMemo<Group[]>(() => {
    if (!d) return [];
    const map = new Map<string, Group>();
    for (const p of d.ph) {
      const m = by === "forum" && p.meeting_id ? d.list.find((x) => x.id === p.meeting_id) : null;
      const key = m ? m.id : by === "forum" ? `day-${p.taken_on}` : p.taken_on.slice(0, 7);
      const title = m
        ? `${short(m.held_on)} · ${meetingTitle(m)}`
        : by === "forum"
          ? long(p.taken_on)
          : new Date(`${p.taken_on.slice(0, 7)}-15T12:00:00Z`).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
      if (!map.has(key)) map.set(key, { key, title, photos: [] });
      map.get(key)!.photos.push(p);
    }
    return [...map.values()];
  }, [d, by]);
  const flat = groups.flatMap((g) => g.photos);
  const tile = (width - space.page * 2 - 6) / 3;

  async function pick() {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsMultipleSelection: true, selectionLimit: 20, quality: 1 });
    if (!r.canceled) setPicked(r.assets.map((a) => ({ uri: a.uri, width: a.width, height: a.height, mimeType: a.mimeType, fileSize: a.fileSize })));
  }

  return (
    <ForumScreen banner="front">
      {loading && !d ? <Loading /> : null}
      {error ? <Banner tone={color.red}>{error}</Banner> : null}
      <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
        <View style={{ flex: 1 }}>
          <Seg options={[{ key: "forum", label: "By forum" }, { key: "month", label: "By month" }] as const} value={by} onChange={setBy} />
        </View>
        <Button small label="+ Add" onPress={pick} />
      </View>
      {d && !d.ph.length ? <Empty>No photos yet. Add the first one.</Empty> : null}
      {groups.map((g) => (
        <View key={g.key} style={{ gap: 6 }}>
          <Eyebrow>{`${g.title} · ${g.photos.length}`}</Eyebrow>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 3 }}>
            {g.photos.map((p) => (
              <Pressable key={p.id} onPress={() => setOpen(flat.indexOf(p))} accessibilityRole="imagebutton" accessibilityLabel={`Photo, ${g.title}`}>
                <Image source={{ uri: p.thumb ?? undefined }} style={{ width: tile, height: tile, backgroundColor: color.avatarFrom }} contentFit="cover" transition={150} />
              </Pressable>
            ))}
          </View>
        </View>
      ))}

      <Modal visible={open !== null} animationType="fade" onRequestClose={() => setOpen(null)} presentationStyle="fullScreen">
        <View style={{ flex: 1, backgroundColor: color.bg, paddingTop: insets.top }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", padding: space.page }}>
            <Pressable onPress={() => setOpen(null)} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close">
              <Text style={{ color: color.ink, fontSize: fs.xl }}>✕</Text>
            </Pressable>
            <Small>{open !== null ? `${open + 1} of ${flat.length}` : ""}</Small>
          </View>
          {open !== null ? (
            <FlatList
              data={flat}
              horizontal
              pagingEnabled
              initialScrollIndex={open}
              getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
              onMomentumScrollEnd={(e) => setOpen(Math.round(e.nativeEvent.contentOffset.x / width))}
              keyExtractor={(p) => p.id}
              renderItem={({ item }) => (
                <View style={{ width, flex: 1, gap: 10 }}>
                  <Image source={{ uri: item.web ?? item.thumb ?? undefined }} style={{ width, flex: 1 }} contentFit="contain" />
                  <View style={{ paddingHorizontal: space.page, paddingBottom: insets.bottom + 16, gap: 8 }}>
                    <Small>
                      {long(item.taken_on)}
                      {item.uploader ? ` · added by ${item.uploader}` : ""}
                    </Small>
                    {item.caption ? <Small tone={color.inkSoft}>{item.caption}</Small> : null}
                    <Button ghost small label="Save or share" onPress={() => share(item)} />
                  </View>
                </View>
              )}
            />
          ) : null}
        </View>
      </Modal>

      {picked ? (
        <AddSheet
          photos={picked}
          forums={(d?.list ?? []).filter((m) => m.held_on <= today())}
          onClose={(changed) => {
            setPicked(null);
            if (changed) reload();
          }}
        />
      ) : null}
    </ForumScreen>
  );
}

async function share(p: Photo) {
  if (!p.web) return;
  const file = await File.downloadFileAsync(p.web, new File(Paths.cache, `shadow-${p.id}.webp`), { idempotent: true });
  await Sharing.shareAsync(file.uri, { mimeType: "image/webp" });
}

function AddSheet({ photos, forums, onClose }: { photos: PickedPhoto[]; forums: data.ForumListItem[]; onClose: (changed: boolean) => void }) {
  const insets = useSafeAreaInsets();
  const [at, setAt] = useState<string>(forums[0]?.id ?? "today");
  const [state, setState] = useState<string[]>(photos.map(() => "Waiting"));
  const [busy, setBusy] = useState(false);
  const done = state.every((s) => s === "Added" || s.startsWith("Error"));
  const started = state.some((s) => s !== "Waiting");

  async function upload() {
    setBusy(true);
    const m = forums.find((x) => x.id === at);
    const target = { meetingId: m?.id ?? null, takenOn: m?.held_on ?? today() };
    for (let i = 0; i < photos.length; i++) {
      setState((s) => s.map((x, k) => (k === i ? "Uploading" : x)));
      try {
        await data.uploadPhoto(photos[i], target);
        setState((s) => s.map((x, k) => (k === i ? "Added" : x)));
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setState((s) => s.map((x, k) => (k === i ? `Error: ${msg}` : x)));
      }
    }
    setBusy(false);
  }

  return (
    <Modal transparent animationType="slide" onRequestClose={() => onClose(started)}>
      <Pressable style={{ flex: 1, backgroundColor: color.scrim }} onPress={() => !busy && onClose(started)} />
      <View style={{ backgroundColor: color.popover, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: space.page, paddingBottom: insets.bottom + 16, gap: 10, maxHeight: "80%" }}>
        <Text style={{ fontFamily: font.display, fontSize: fs.xl2, color: color.ink }}>{`ADD ${photos.length} PHOTO${photos.length === 1 ? "" : "S"}`}</Text>
        <Eyebrow>Taken at</Eyebrow>
        <FlatList
          horizontal
          data={[...forums.slice(0, 8).map((m) => ({ id: m.id, label: `${short(m.held_on)} · ${meetingTitle(m)}` })), { id: "today", label: "Today, not at a forum" }]}
          keyExtractor={(x) => x.id}
          contentContainerStyle={{ gap: 6 }}
          showsHorizontalScrollIndicator={false}
          renderItem={({ item }) => (
            <Pressable onPress={() => !started && setAt(item.id)} style={{ borderWidth: 1, borderColor: at === item.id ? color.ink : color.line, backgroundColor: at === item.id ? color.ink : "transparent", paddingHorizontal: 10, paddingVertical: 7 }}>
              <Text style={{ color: at === item.id ? color.bg : color.inkSoft, fontFamily: font.semi, fontSize: fs.sm }}>{item.label}</Text>
            </Pressable>
          )}
        />
        {photos.map((p, i) => (
          <Row key={p.uri} title={p.uri.split("/").pop() ?? `Photo ${i + 1}`} right={<Small tone={state[i] === "Added" ? color.green : state[i].startsWith("Error") ? color.red : color.muted}>{state[i]}</Small>} />
        ))}
        {done && started ? <Button label="Done" onPress={() => onClose(true)} /> : <Button label="Upload" onPress={upload} busy={busy} disabled={started} />}
        {!started ? <Button ghost label="Cancel" onPress={() => onClose(false)} /> : null}
      </View>
    </Modal>
  );
}
