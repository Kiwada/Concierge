import styles from "./VideoBanner.module.css";

type VideoBannerProps = {
    src: string;
    poster?: string;
    ariaLabel?: string;
    eyebrow?: string;
    titleMain?: string;
    titleSecondary?: string;
    supportingCopy?: string;
    metaCopy?: string;
    contactLabel?: string;
};

const VideoBanner = ({
    src,
    poster,
    ariaLabel = "Video em loop do litoral do Piaui",
    titleMain = "Concierge",
    eyebrow = "digital para o turismo no Piauí",
    titleSecondary = "",
    supportingCopy = "Recomendações locais e apoio rápido para planejar melhor cada etapa da viagem.",
    metaCopy = "•Experiências • Atendimento Personalizado",
    contactLabel = "Falar com a Lia",
}: VideoBannerProps) => {
    const hasContent = Boolean(
        eyebrow || titleMain || titleSecondary || supportingCopy || metaCopy || contactLabel,
    );

    const handleContactClick = () => {
        if (typeof window === "undefined") return;
        window.dispatchEvent(new CustomEvent("concierge:open-chat"));
    };

    return (
        <section className={styles.banner} aria-label={ariaLabel}>
            <video
                className={styles.video}
                autoPlay
                muted
                loop
                playsInline
                preload="metadata"
                poster={poster}
            >
                <source src={src} type="video/mp4" />
            </video>

            {hasContent ? <div className={styles.overlay} /> : null}

            {hasContent ? (
                <div className={styles.content}>
                    <div className={styles.capsule}>
                        {titleMain || titleSecondary ? (
                            <div className={styles.titleBlock}>
                                {titleMain ? <strong className={styles.titleMain}>{titleMain}</strong> : null}
                                {titleSecondary ? <span className={styles.titleSecondary}>{titleSecondary}</span> : null}
                            </div>
                        ) : null}
                        {eyebrow ? <span className={styles.eyebrow}>{eyebrow}</span> : null}

                        {supportingCopy ? <p className={styles.supportingCopy}>{supportingCopy}</p> : null}
                        {metaCopy ? <span className={styles.metaCopy}>{metaCopy}</span> : null}

                        <button type="button" className={styles.contactButton} onClick={handleContactClick}>
                            {contactLabel}
                        </button>
                    </div>
                </div>
            ) : null}
        </section>
    );
};

export default VideoBanner;
