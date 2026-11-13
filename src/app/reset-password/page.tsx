import { ResetPasswordForm } from "@/app/reset-password/reset-password-form";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function ResetPasswordPage(props: PageProps<"/reset-password">) {
  const searchParams = await (props as { searchParams: SearchParams }).searchParams;
  const error = typeof searchParams?.error === "string" ? searchParams.error : null;

  return <ResetPasswordForm initialError={error} />;
}
