import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { FaBellConcierge, FaGlobe, FaHouse, FaUmbrellaBeach } from "react-icons/fa6";
import { FiMenu, FiSearch } from "react-icons/fi";
import styles from "./Header.module.css";

const navItems = [
  { id: "home", label: "Home", icon: FaHouse },
  { id: "experiencias", label: "Experiências", icon: FaUmbrellaBeach },
  { id: "servicos", label: "Serviços", icon: FaBellConcierge },
];

const Header = () => {
  const [activeNav, setActiveNav] = useState<(typeof navItems)[number]["id"]>("home");
  const [isCompact, setIsCompact] = useState(false);

  useEffect(() => {
    const COMPACT_ENTER_Y = 92;
    const COMPACT_EXIT_Y = 28;
    let rafId = 0;

    const onScroll = () => {
      if (rafId) return;

      rafId = window.requestAnimationFrame(() => {
        const y = window.scrollY;
        setIsCompact((prev) => {
          if (!prev && y >= COMPACT_ENTER_Y) return true;
          if (prev && y <= COMPACT_EXIT_Y) return false;
          return prev;
        });
        rafId = 0;
      });
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, []);

  const activeIndex = useMemo(
    () => navItems.findIndex((item) => item.id === activeNav),
    [activeNav],
  );

  return (
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
          <button type="button" className={styles.hostButton}>
            Torne-se parceiro
          </button>
          <button type="button" className={styles.iconCircle} aria-label="Idioma">
            <FaGlobe />
          </button>
          <button type="button" className={styles.iconCircle} aria-label="Menu">
            <FiMenu />
          </button>
        </div>
      </div>

      <form
        className={`${styles.searchBar} ${isCompact ? styles.searchBarHidden : ""}`}
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
    </header>
  );
};

export default Header;
