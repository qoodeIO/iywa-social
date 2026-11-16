import { useState } from "react";
import { View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useTheme } from "../../theme";
import { personByHandle } from "../../data";
import { MoreHorizontal, Verified } from "../../ui/icons-profile";
import { Header, IconBtn, T } from "../../ui/kit";
import { IgEmpty } from "../../ui/profile-kit";
import { PersonProfile } from "../../ui/profile";
import { t } from "../../lib/i18n";

// Someone else's profile, opened from Search, comments, Pensieri or Direct.
export default function Person() {
  const theme = useTheme();
  const { handle } = useLocalSearchParams();
  const person = personByHandle(handle);
  const [menu, setMenu] = useState(false);
  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <Header
        title={(
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <T size={17} weight="700" lines={1}>{person?.handle || t("Profilo")}</T>
            {person?.verified ? <Verified size={15} weight="fill" color={theme.blue} /> : null}
          </View>
        )}
        right={person ? <IconBtn icon={MoreHorizontal} weight="bold" label={t("Altro")} onPress={() => setMenu(true)} /> : null}
      />
      {person ? <PersonProfile key={person.handle} person={person} menu={menu} setMenu={setMenu} /> : <IgEmpty title={t("Profilo non trovato")} />}
    </View>
  );
}
