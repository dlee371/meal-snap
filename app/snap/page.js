// /snap: take or pick a meal photo and upload it.
import { requireUser } from "@/lib/session";
import PhotoPicker from "@/components/PhotoPicker";

export const metadata = { title: "Snap a meal · Meal Snap Logger" };

export default async function SnapPage() {
  await requireUser("/snap");

  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">Snap a meal</h1>
      <PhotoPicker />
    </section>
  );
}
