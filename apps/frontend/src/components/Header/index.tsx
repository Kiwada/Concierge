import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { FaBellConcierge, FaGlobe, FaHouse, FaUmbrellaBeach } from "react-icons/fa6";
import {
  FiCheck,
  FiHelpCircle,
  FiLogIn,
  FiLogOut,
  FiMenu,
  FiSearch,
  FiUser,
  FiUserPlus,
} from "react-icons/fi";
import AuthModal from "../AuthModal";
import { useAuth } from "../../contexts/AuthContext";
import styles from "./Header.module.css";

const navItems = [
  { id: "home", label: "Home", icon: FaHouse },
  { id: "experiencias", label: "Experiências", icon: FaUmbrellaBeach },
  { id: "servicos", label: "Serviços", icon: FaBellConcierge },
];

const languageOptions = [
  { code: "en", label: "English", country: "United States", flag: "🇺🇸" },
  { code: "pt-BR", label: "Português (Brasil)", country: "Brasil", flag: "🇧🇷" },
  { code: "es", label: "Español", country: "España", flag: "🇪🇸" },
] as const;

const MOBILE_BREAKPOINT_QUERY = "(max-width: 860px)";
const COMPACT_ENTER_SCROLL_Y = 132;
const COMPACT_EXIT_SCROLL_Y = 56;
type AuthModalMode = "sign-in" | "sign-up";

const Header = () => {
  const { isAuthenticated, isConfigured, isLoading, signOut, user } = useAuth();
  const [activeNav, setActiveNav] = useState<(typeof navItems)[number]["id"]>("home");
  const [isCompact, setIsCompact] = useState(false);
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<AuthModalMode>("sign-in");
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const [isLanguageMenuOpen, setIsLanguageMenuOpen] = useState(false);
  const [selectedLanguage, setSelectedLanguage] =
    useState<(typeof languageOptions)[number]["code"]>("pt-BR");
  const accountMenuRef = useRef<HTMLDivElement | null>(null);
  const languageMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const mediaQuery = window.matchMedia(MOBILE_BREAKPOINT_QUERY);
    let frameId = 0;

    const syncCompactState = (scrollY: number) => {
      if (mediaQuery.matches) {
        setIsCompact(false);
        return;
      }

      setIsCompact((previousState) => {
        if (scrollY >= COMPACT_ENTER_SCROLL_Y) {
          return true;
        }

        if (scrollY <= COMPACT_EXIT_SCROLL_Y) {
          return false;
        }

        return previousState;
      });
    };

    const queueCompactSync = () => {
      if (frameId) return;

      frameId = window.requestAnimationFrame(() => {
        frameId = 0;
        syncCompactState(window.scrollY);
      });
    };

    syncCompactState(window.scrollY);

    const handleMediaChange = () => {
      if (mediaQuery.matches) {
        setIsMobileSearchOpen(false);
      }

      syncCompactState(window.scrollY);
    };

    window.addEventListener("scroll", queueCompactSync, { passive: true });
    window.addEventListener("resize", queueCompactSync);
    mediaQuery.addEventListener("change", handleMediaChange);

    return () => {
      if (frameId) {
        window.cancelAnimationFrame(frameId);
      }

      window.removeEventListener("scroll", queueCompactSync);
      window.removeEventListener("resize", queueCompactSync);
      mediaQuery.removeEventListener("change", handleMediaChange);
    };
  }, []);

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth > 860) {
        setIsMobileSearchOpen(false);
      }
    };

    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleChatState = (event: Event) => {
      const customEvent = event as CustomEvent<{ open?: boolean }>;
      setIsChatOpen(Boolean(customEvent.detail?.open));
    };

    window.addEventListener("concierge:chat-state", handleChatState as EventListener);

    return () => {
      window.removeEventListener("concierge:chat-state", handleChatState as EventListener);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    window.dispatchEvent(
      new CustomEvent("concierge:auth-modal-state", {
        detail: { open: isAuthModalOpen },
      }),
    );
  }, [isAuthModalOpen]);

  useEffect(() => {
    if (!isLanguageMenuOpen && !isAccountMenuOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;

      if (!languageMenuRef.current?.contains(target)) {
        setIsLanguageMenuOpen(false);
      }

      if (!accountMenuRef.current?.contains(target)) {
        setIsAccountMenuOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsLanguageMenuOpen(false);
        setIsAccountMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isAccountMenuOpen, isLanguageMenuOpen]);

  const activeIndex = useMemo(
    () => navItems.findIndex((item) => item.id === activeNav),
    [activeNav],
  );

  const selectedLanguageOption = useMemo(
    () =>
      languageOptions.find((option) => option.code === selectedLanguage) ?? languageOptions[1],
    [selectedLanguage],
  );

  const profileLabel = useMemo(() => {
    const metadataName = user?.user_metadata?.full_name;
    if (typeof metadataName === "string" && metadataName.trim()) {
      return metadataName.trim();
    }

    const email = user?.email?.trim();
    if (!email) return "Conta";

    return email.split("@")[0];
  }, [user]);

  const openAuthModal = (mode: AuthModalMode) => {
    if (isChatOpen) {
      return;
    }

    setAuthModalMode(mode);
    setIsAccountMenuOpen(false);
    setIsLanguageMenuOpen(false);
    setIsMobileSearchOpen(false);
    setIsAuthModalOpen(true);
  };

  const openHelpCenter = () => {
    setIsAccountMenuOpen(false);

    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("concierge:open-chat"));
    }
  };

  const handleMenuSignOut = () => {
    setIsAccountMenuOpen(false);
    void signOut();
  };

  return (
    <>
      <div
        className={`${styles.headerShell} ${
          isCompact ? styles.headerShellCompact : styles.headerShellExpanded
        }`}
      >
        <header className={`${styles.header} ${isCompact ? styles.compact : ""}`}>
          <div className={styles.topBar}>
            <a href="#" className={styles.brand} aria-label="ConciergeHub">
              <img
                src="/icon-concierge.png"
                alt=""
                aria-hidden="true"
                className={styles.brandIcon}
              />
              <span className={styles.brandText}>ConciergeHub</span>
            </a>

            <nav
              className={styles.primaryNav}
              aria-label="Navegação principal"
              style={{ "--active-index": activeIndex } as CSSProperties}
            >
              {navItems.map(({ id, label, icon: Icon }) => (
                <a
                  key={id}
                  href="#"
                  onClick={(event) => {
                    event.preventDefault();
                    setActiveNav(id);
                  }}
                  className={`${styles.navItem} ${
                    activeNav === id ? styles.navItemActive : ""
                  }`}
                >
                  <Icon className={styles.navIcon} />
                  <span>{label}</span>
                </a>
              ))}
              <span className={styles.navIndicator} aria-hidden="true" />
            </nav>

            <button
              type="button"
              className={`${styles.compactSearch} ${
                isCompact ? styles.compactSearchVisible : ""
              }`}
              aria-label="Abrir busca"
            >
              <span className={styles.compactSearchText}>
                Buscar destinos, datas e serviços
              </span>
              <span className={styles.compactSearchIcon}>
                <FiSearch />
              </span>
            </button>

            <div className={styles.topActions}>
              <button
                type="button"
                className={`${styles.iconCircle} ${styles.mobileSearchToggle} ${
                  isMobileSearchOpen ? styles.mobileSearchToggleActive : ""
                }`}
                aria-label={isMobileSearchOpen ? "Fechar busca" : "Abrir busca"}
                aria-expanded={isMobileSearchOpen}
                aria-controls="header-search-form"
                onClick={() => setIsMobileSearchOpen((prev) => !prev)}
              >
                <FiSearch />
              </button>
              {isAuthenticated ? (
                <div className={styles.authSummary}>
                  <button type="button" className={styles.authButtonLogged}>
                    {profileLabel}
                  </button>
                  <button
                    type="button"
                    className={styles.authLogoutButton}
                    onClick={() => void signOut()}
                  >
                    Sair
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className={styles.authButton}
                  onClick={() => openAuthModal("sign-in")}
                  disabled={isLoading || isChatOpen}
                >
                  {isLoading ? "Carregando..." : isConfigured ? "Entrar" : "Login"}
                </button>
              )}
              <div ref={languageMenuRef} className={styles.languageWrap}>
                <button
                  type="button"
                  className={`${styles.iconCircle} ${
                    isLanguageMenuOpen ? styles.languageButtonActive : ""
                  }`}
                  aria-label={`Idioma atual: ${selectedLanguageOption.label}`}
                  aria-haspopup="menu"
                  aria-controls="header-language-menu"
                  aria-expanded={isLanguageMenuOpen}
                  onClick={() => {
                    setIsAccountMenuOpen(false);
                    setIsLanguageMenuOpen((prev) => !prev);
                  }}
                >
                  <FaGlobe />
                </button>

                {isLanguageMenuOpen && (
                  <div
                    id="header-language-menu"
                    className={styles.languageMenu}
                    role="menu"
                    aria-label="Selecionar idioma"
                  >
                    {languageOptions.map((option) => (
                      <button
                        key={option.code}
                        type="button"
                        role="menuitemradio"
                        aria-checked={selectedLanguage === option.code}
                        className={`${styles.languageOption} ${
                          selectedLanguage === option.code ? styles.languageOptionActive : ""
                        }`}
                        onClick={() => {
                          setSelectedLanguage(option.code);
                          setIsLanguageMenuOpen(false);
                        }}
                      >
                        <span className={styles.languageOptionMain}>
                          <span className={styles.languageFlag} aria-hidden="true">
                            {option.flag}
                          </span>
                          <span className={styles.languageName}>{option.label}</span>
                        </span>
                        <span
                          className={`${styles.languageCheck} ${
                            selectedLanguage === option.code ? styles.languageCheckVisible : ""
                          }`}
                          aria-hidden="true"
                        >
                          <FiCheck />
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div ref={accountMenuRef} className={styles.accountMenuWrap}>
                <button
                  type="button"
                  className={`${styles.iconCircle} ${
                    isAccountMenuOpen ? styles.accountMenuTriggerActive : ""
                  }`}
                  aria-label="Abrir menu"
                  aria-haspopup="menu"
                  aria-controls="header-account-menu"
                  aria-expanded={isAccountMenuOpen}
                  onClick={() => {
                    setIsLanguageMenuOpen(false);
                    setIsAccountMenuOpen((prev) => !prev);
                  }}
                >
                  <FiMenu />
                </button>

                {isAccountMenuOpen && (
                  <div
                    id="header-account-menu"
                    className={styles.accountMenu}
                    role="menu"
                    aria-label="Acesso e ajuda"
                  >
                    {isAuthenticated ? (
                      <>
                        <div className={styles.accountMenuProfile}>
                          <span
                            className={`${styles.accountMenuIcon} ${styles.accountMenuIconNeutral}`}
                            aria-hidden="true"
                          >
                            <FiUser />
                          </span>
                          <span className={styles.accountMenuCopy}>
                            <span className={styles.accountMenuTitle}>{profileLabel}</span>
                            <span className={styles.accountMenuSubtitle}>
                              {user?.email?.trim() || "Conta conectada"}
                            </span>
                          </span>
                        </div>

                        <div className={styles.accountMenuDivider} aria-hidden="true" />

                        <button
                          type="button"
                          className={`${styles.accountMenuItem} ${styles.accountMenuItemSecondary}`}
                          role="menuitem"
                          onClick={openHelpCenter}
                        >
                          <span className={styles.accountMenuIcon} aria-hidden="true">
                            <FiHelpCircle />
                          </span>
                          <span className={styles.accountMenuCopy}>
                            <span className={styles.accountMenuTitle}>Central de ajuda</span>
                            <span className={styles.accountMenuSubtitle}>
                              Abra a Lia para tirar suas duvidas rapidamente.
                            </span>
                          </span>
                        </button>

                        <button
                          type="button"
                          className={`${styles.accountMenuItem} ${styles.accountMenuItemDanger}`}
                          role="menuitem"
                          onClick={handleMenuSignOut}
                        >
                          <span className={styles.accountMenuIcon} aria-hidden="true">
                            <FiLogOut />
                          </span>
                          <span className={styles.accountMenuCopy}>
                            <span className={styles.accountMenuTitle}>Sair</span>
                            <span className={styles.accountMenuSubtitle}>
                              Encerrar sessao neste dispositivo.
                            </span>
                          </span>
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          className={`${styles.accountMenuItem} ${styles.accountMenuItemPrimary} ${
                            isChatOpen ? styles.accountMenuItemLocked : ""
                          }`}
                          role="menuitem"
                          onClick={() => openAuthModal("sign-in")}
                          disabled={isChatOpen}
                        >
                          <span className={styles.accountMenuIcon} aria-hidden="true">
                            <FiLogIn />
                          </span>
                          <span className={styles.accountMenuCopy}>
                            <span className={styles.accountMenuTitle}>Entrar</span>
                            <span className={styles.accountMenuSubtitle}>
                              Acesse sua conta e continue o atendimento.
                            </span>
                          </span>
                        </button>

                        <button
                          type="button"
                          className={`${styles.accountMenuItem} ${styles.accountMenuItemPrimary} ${
                            isChatOpen ? styles.accountMenuItemLocked : ""
                          }`}
                          role="menuitem"
                          onClick={() => openAuthModal("sign-up")}
                          disabled={isChatOpen}
                        >
                          <span className={styles.accountMenuIcon} aria-hidden="true">
                            <FiUserPlus />
                          </span>
                          <span className={styles.accountMenuCopy}>
                            <span className={styles.accountMenuTitle}>Cadastre-se</span>
                            <span className={styles.accountMenuSubtitle}>
                              Crie seu acesso para salvar preferencias.
                            </span>
                          </span>
                        </button>

                        <div className={styles.accountMenuDivider} aria-hidden="true" />

                        <button
                          type="button"
                          className={`${styles.accountMenuItem} ${styles.accountMenuItemSecondary}`}
                          role="menuitem"
                          onClick={openHelpCenter}
                        >
                          <span className={styles.accountMenuIcon} aria-hidden="true">
                            <FiHelpCircle />
                          </span>
                          <span className={styles.accountMenuCopy}>
                            <span className={styles.accountMenuTitle}>Central de ajuda</span>
                            <span className={styles.accountMenuSubtitle}>
                              Abra a Lia para tirar suas duvidas rapidamente.
                            </span>
                          </span>
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div
            className={`${styles.searchLayer} ${
              isCompact ? styles.searchLayerHidden : styles.searchLayerVisible
            } ${
              isMobileSearchOpen
                ? styles.searchLayerMobileVisible
                : styles.searchLayerMobileHidden
            }`}
          >
            <form
              id="header-search-form"
              className={styles.searchBar}
              role="search"
              onSubmit={(event) => event.preventDefault()}
            >
              <label className={styles.searchField}>
                <span className={styles.fieldLabel}>Onde</span>
                <input
                  type="text"
                  className={styles.fieldInput}
                  placeholder="Buscar destinos"
                />
              </label>

              <label className={styles.searchField}>
                <span className={styles.fieldLabel}>Quando</span>
                <input
                  type="text"
                  className={styles.fieldInput}
                  placeholder="Insira as datas"
                />
              </label>

              <label className={styles.searchField}>
                <span className={styles.fieldLabel}>Tipo de serviço</span>
                <input
                  type="text"
                  className={styles.fieldInput}
                  placeholder="Adicionar serviço"
                />
              </label>

              <button type="submit" className={styles.searchButton} aria-label="Buscar">
                <FiSearch />
              </button>
            </form>
          </div>
        </header>
      </div>

      <AuthModal
        isOpen={isAuthModalOpen}
        initialMode={authModalMode}
        onClose={() => setIsAuthModalOpen(false)}
      />
    </>
  );
};

export default Header;
