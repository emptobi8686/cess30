import { messageFromCode } from "@/lib/auth/messages";
import { ResetPasswordForm } from "@/app/reset-password/reset-password-form";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function ResetPasswordPage(props: PageProps<"/reset-password">) {
  const searchParams = await (props as { searchParams: SearchParams }).searchParams;
  const error = messageFromCode(searchParams?.error);

  return <ResetPasswordForm initialError={error} />;
}
