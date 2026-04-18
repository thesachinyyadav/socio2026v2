type Props = {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
};

export default async function EventLayout({ children }: Props) {
  return <>{children}</>;
}
