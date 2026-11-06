import { useState } from "react";
import {
  ArrowUpRight,
  Bell,
  Bookmark,
  Clapperboard,
  Heart,
  House,
  MessageCircle,
  MessageSquareText,
  Search,
} from "lucide-react";

const PORTRAIT =
  "https://images.unsplash.com/photo-1633527068411-d479d0b782b6?auto=format&fit=crop&w=1400&h=1800&q=85&crop=faces";

const AVATAR =
  "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=240&h=240&q=80";

const PEOPLE = [
  {
    name: "Marta Colle",
    meta: "Cucina · Torino",
    src: "https://images.unsplash.com/photo-1531123897727-8f129e1688ce?auto=format&fit=crop&w=900&h=700&q=80",
  },
  {
    name: "Leo Bassi",
    meta: "Liuteria · Cremona",
    src: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=900&h=700&q=80",
  },
  {
    name: "Adele Romano",
    meta: "Tessuti · Prato",
    src: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=900&h=700&q=80",
  },
  {
    name: "Nico Serra",
    meta: "Ricerca · Bologna",
    src: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=900&h=700&q=80",
  },
];

const TABS = [
  { id: "home", label: "Home" },
  { id: "activity", label: "Activity" },
  { id: "search", label: "Search" },
  { id: "messages", label: "Messages" },
  { id: "profile", label: "Profile" },
];

const COPY = {
  activity: {
    title: "Activity",
    body: "I passi nuovi dei cantieri che segui tornano su Home. Questa vista non è ancora una schermata.",
  },
  search: {
    title: "Search",
    body: "Scopri per città e mestiere arriva dopo. Qui resta solo il vetro, senza una lista.",
  },
  messages: {
    title: "Messages",
    body: "I fili dei contributi — domanda, riferimento, offerta — non sono in questa prima schermata.",
  },
};

const TAB_ICONS = {
  activity: Clapperboard,
  search: Search,
  messages: MessageSquareText,
};

function Glyph({ icon: Icon }) {
  return <Icon strokeWidth={2} aria-hidden="true" />;
}

function StatusBar() {
  return (
    <div className="statusbar">
      <span className="time">9:38</span>
      <div className="island" aria-hidden="true">
        <span className="lens" />
      </div>
      <div className="status-icons" aria-hidden="true">
        <svg width="17" height="12" viewBox="0 0 17 12">
          <rect x="0" y="7.2" width="3" height="4.8" rx="0.7" fill="white" />
          <rect x="4.6" y="4.8" width="3" height="7.2" rx="0.7" fill="white" />
          <rect x="9.2" y="2.4" width="3" height="9.6" rx="0.7" fill="white" />
          <rect x="13.8" y="0" width="3" height="12" rx="0.7" fill="white" />
        </svg>
        <svg width="16" height="12" viewBox="0 0 16 12">
          <path
            d="M1.4 4.6a9.2 9.2 0 0 1 13.2 0"
            fill="none"
            stroke="white"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <path
            d="M3.8 7.2a5.6 5.6 0 0 1 8.4 0"
            fill="none"
            stroke="white"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <circle cx="8" cy="10" r="1.15" fill="white" />
        </svg>
        <svg width="27" height="13" viewBox="0 0 27 13">
          <rect
            x="0.7"
            y="0.7"
            width="22"
            height="11.6"
            rx="3.2"
            fill="none"
            stroke="white"
            strokeOpacity="0.42"
            strokeWidth="1.2"
          />
          <rect x="2.3" y="2.3" width="16.4" height="8.4" rx="1.6" fill="white" />
          <path
            d="M24.2 4.4c.7.5 1.1 1.2 1.1 2.1s-.4 1.6-1.1 2.1"
            fill="none"
            stroke="white"
            strokeOpacity="0.5"
            strokeWidth="1.3"
            strokeLinecap="round"
          />
        </svg>
      </div>
    </div>
  );
}

function Frame({ children }) {
  return (
    <div className="fit">
    <div className="device">
      <span className="side silent" />
      <span className="side vol-up" />
      <span className="side vol-down" />
      <span className="side power" />
      <div className="bezel">
        <div className="screen">{children}</div>
      </div>
    </div>
    </div>
  );
}

function RemoteImage({ src, alt, className, priority = false }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <div className={`figure ${className || ""}`} role="img" aria-label={alt}>
        <span className="figure-head" />
        <span className="figure-body" />
      </div>
    );
  }
  return (
    <img
      className={className}
      src={src}
      alt={alt}
      draggable="false"
      fetchPriority={priority ? "high" : "auto"}
      onError={() => setFailed(true)}
    />
  );
}

function Home({ liked, saved, following, onLike, onSave, onFollow }) {
  return (
    <div className="home view">
      <article className="post-card">
        <RemoteImage
          className="cover"
          src={PORTRAIT}
          alt="Prova dello smalto, figura su campo rosso"
          priority
        />
        <div className="card-shade" />
        <div className="card-top">
          <RemoteImage className="avatar" src={AVATAR} alt="" />
          <div className="who">
            <div className="name">Giulia Neri</div>
            <div className="handle">@forno.neri</div>
          </div>
          <button
            type="button"
            className={following ? "follow on" : "follow"}
            onClick={onFollow}
            aria-pressed={following}
          >
            {following ? "Following" : "Follow"}
          </button>
        </div>
        <div className="dots" aria-hidden="true">
          <i className="on" />
          <i />
          <i />
          <i />
          <i />
          <i />
        </div>
      </article>

      <p className="caption">Prima prova del nuovo smalto. Il rosso regge.</p>

      <div className="actions">
        <button type="button" className={liked ? "pill on" : "pill"} onClick={onLike} aria-pressed={liked}>
          <Glyph icon={Heart} />
          <span>1.8k</span>
        </button>
        <button type="button" className="pill" aria-label="Commenti, 347">
          <Glyph icon={MessageCircle} />
          <span>347</span>
        </button>
        <button type="button" className={saved ? "pill on" : "pill"} onClick={onSave} aria-pressed={saved}>
          <Glyph icon={Bookmark} />
          <span>98</span>
        </button>
        <button type="button" className="pill share" aria-label="Condividi, 76">
          <Glyph icon={ArrowUpRight} />
          <span>76</span>
        </button>
      </div>

      <h2 className="section-title">People you may know</h2>
      <div className="rail">
        {PEOPLE.map((person) => (
          <article
            key={person.name}
            className="person"
            aria-label={`${person.name}, ${person.meta}`}
          >
            <RemoteImage src={person.src} alt="" />
          </article>
        ))}
      </div>
    </div>
  );
}

function Placeholder({ id }) {
  if (id === "profile") {
    return (
      <div className="placeholder view">
        <section className="sheet profile-sheet">
          <RemoteImage className="profile-avatar" src={AVATAR} alt="" />
          <h2>Profile</h2>
          <p className="profile-name">Giulia Neri</p>
          <p className="profile-meta">Milano · Ceramica</p>
          <p className="profile-bio">Un forno, un cantiere aperto. La scheda completa non è in questa prima schermata.</p>
        </section>
      </div>
    );
  }
  const copy = COPY[id];
  return (
    <div className="placeholder view">
      <section className="sheet">
        <h2>{copy.title}</h2>
        <p>{copy.body}</p>
      </section>
    </div>
  );
}

function TabBar({ tab, onChange }) {
  return (
    <nav className="tabbar" aria-label="Principale">
      {TABS.map((item) => {
        const selected = tab === item.id;
        if (item.id === "home") {
          return (
            <button
              key={item.id}
              type="button"
              className={selected ? "tab-home" : "tab-icon"}
              aria-current={selected ? "page" : undefined}
              onClick={() => onChange(item.id)}
            >
              <Glyph icon={House} />
              {selected ? <span>Home</span> : null}
            </button>
          );
        }
        if (item.id === "profile") {
          return (
            <button
              key={item.id}
              type="button"
              className={selected ? "tab-avatar on" : "tab-avatar"}
              aria-label="Profile"
              aria-current={selected ? "page" : undefined}
              onClick={() => onChange(item.id)}
            >
              <RemoteImage src={AVATAR} alt="" />
            </button>
          );
        }
        return (
          <button
            key={item.id}
            type="button"
            className={selected ? "tab-icon on" : "tab-icon"}
            aria-label={item.label}
            aria-current={selected ? "page" : undefined}
            onClick={() => onChange(item.id)}
          >
            <Glyph icon={TAB_ICONS[item.id]} />
          </button>
        );
      })}
    </nav>
  );
}

export default function App() {
  const [tab, setTab] = useState(() => {
    const query = new URLSearchParams(window.location.search).get("tab");
    return ["home", "activity", "search", "messages", "profile"].includes(query) ? query : "home";
  });
  const [note, setNote] = useState(false);
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  const [following, setFollowing] = useState(false);

  return (
    <div className="stage">
          <Frame>
            <div className="screen-root" data-screen={tab}>
              <StatusBar />
              <header className="topbar">
                <h1>Space</h1>
                <button
                  type="button"
                  className={note ? "bell on" : "bell"}
                  aria-label="Notifiche"
                  aria-expanded={note}
                  onClick={() => setNote((open) => !open)}
                >
                  <Glyph icon={Bell} />
                  <span className="bell-dot" />
                </button>
              </header>
              {note ? (
                <div className="note" role="status">
                  <span className="note-mark" />
                  <div>
                    <strong>Leo Bassi</strong>
                    <p>Ha lasciato un riferimento sul bordo.</p>
                  </div>
                </div>
              ) : null}
              {tab === "home" ? (
                <Home
                  liked={liked}
                  saved={saved}
                  following={following}
                  onLike={() => setLiked((v) => !v)}
                  onSave={() => setSaved((v) => !v)}
                  onFollow={() => setFollowing((v) => !v)}
                />
              ) : (
                <Placeholder id={tab} />
              )}
              <TabBar
                tab={tab}
                onChange={(next) => {
                  setTab(next);
                  setNote(false);
                }}
              />
              <div className="home-indicator" aria-hidden="true" />
            </div>
          </Frame>
    </div>
  );
}
