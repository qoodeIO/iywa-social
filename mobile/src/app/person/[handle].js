import { useState } from "react";
import { View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useTheme } from "../../theme";
import { useMe } from "../../lib/session";
import { useProfile } from "../../lib/social";
import { Lock, MoreHorizontal, Verified } from "../../ui/icons-profile";
import { Header, IconBtn, T } from "../../ui/kit";
import { MyProfile, PersonProfile } from "../../ui/profile";
import { t } from "../../lib/i18n";

// Someone's profile by handle, opened from Search, comments, Pensieri, Direct or a link.
export default function Person() {
  const theme = useTheme();
  const me = useMe();
  const params = useLocalSearchParams();
  const handle = String(params.handle || "").replace(/^@/, "").toLowerCase();
  const mine = Boolean(handle) && handle === me?.handle;
  const { data: person } = useProfile(mine ? null : handle);
  const [menu, setMenu] = useState(false);
  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <Header
        title={(
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            {person?.private ? <Lock size={14} weight="bold" color={theme.text} /> : null}
            <T size={17} weight="700" lines={1}>{handle || t("Profilo")}</T>
            {person?.verified ? <Verified size={15} weight="fill" color={theme.blue} /> : null}
          </View>
        )}
        right={person && !mine ? <IconBtn icon={MoreHorizontal} weight="bold" label={t("Altro")} onPress={() => setMenu(true)} /> : null}
      />
      {mine ? <MyProfile embedded /> : <PersonProfile key={handle} handle={handle} menu={menu} setMenu={setMenu} />}
    </View>
  );
}
