// Message requests (web Messages "requests" view): chats from people you don't follow wait here.
import { ScrollView, View } from "react-native";
import { t } from "../../lib/i18n";
import { EmptyState, Hint, SubHead, useChatTheme } from "../../ui/chat";
import { Inbox } from "../../ui/chatIcons";

export default function MessageRequests() {
  const theme = useChatTheme();
  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <SubHead title={t("Richieste di messaggi")} />
      <ScrollView style={{ backgroundColor: theme.page }}>
        <Hint>{t("Apri una chat per vedere chi l'ha inviata. Non sapranno che l'hai vista finché non accetti.")}</Hint>
        <EmptyState icon={Inbox} title={t("Nessuna richiesta")} text={t("Non hai richieste di messaggi.")} />
      </ScrollView>
    </View>
  );
}
