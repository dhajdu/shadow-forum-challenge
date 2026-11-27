import Image from "next/image";

/** Shadow-crew image band at the top of an inside page, fading into the page. */
export function PageBanner({ src, position = "50% 50%", children }: { src: string; position?: string; children?: React.ReactNode }) {
  return (
    <section className={`banner ${children ? "banner-titled" : ""}`}>
      <Image src={src} alt="" fill sizes="(min-width: 768px) calc(100vw - 216px), 100vw" className="banner-img" style={{ objectPosition: position }} />
      {children && <div className="banner-inner">{children}</div>}
    </section>
  );
}
