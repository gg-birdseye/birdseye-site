export default function EmbedLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="h-[100svh] min-h-full w-full overflow-hidden bg-[#0a120e]">
      {children}
    </div>
  );
}
