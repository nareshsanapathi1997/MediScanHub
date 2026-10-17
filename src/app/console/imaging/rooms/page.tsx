import { requireSession } from "@/server/session";
import { listAccessibleBranches } from "@/lib/services/catalog";
import { listStaff } from "@/lib/services/admin";
import { canManageScanRooms, listScanRooms } from "@/lib/services/scan-rooms";
import { scanRoomAction } from "@/server/actions";
import { SCAN_MODALITIES, modalityLabel } from "@/domain/scan-scheduling";
import { formatDate, formatTime, formatWhen } from "@/lib/format";
import { Gate, NeedTenant } from "@/components/guard";
import { ActionForm } from "@/components/action-form";
import { Breadcrumbs, EmptyState, PageHeader, Panel } from "@/components/widgets";

export const metadata = { title: "Scan rooms" };

const input = "h-9 rounded-lg border bg-background px-2 text-sm";
const button = "h-9 rounded-lg border px-3 text-sm hover:bg-muted";
const primary = "h-9 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground";

function tomorrowIst() {
  const now = new Date(Date.now() + 5.5 * 60 * 60 * 1000 + 24 * 60 * 60 * 1000);
  return now.toISOString().slice(0, 10);
}

export default async function ScanRoomsPage() {
  const { actor } = await requireSession();
  return (
    <Gate actor={actor} permission="imaging.read">
      <NeedTenant actor={actor}>
        <ScanRoomsBody />
      </NeedTenant>
    </Gate>
  );
}

async function ScanRoomsBody() {
  const { actor } = await requireSession();
  const manage = canManageScanRooms(actor, actor.activeTenantId);
  const [rooms, branches, staff] = await Promise.all([
    listScanRooms(actor),
    manage ? listAccessibleBranches(actor) : Promise.resolve([]),
    manage ? listStaff(actor).catch(() => []) : Promise.resolve([]),
  ]);
  // Radiology staff first; the owner is listed last for small centers where the owner also scans.
  const radiographers = staff
    .filter((member) => member.role.key === "RADIOLOGY" || member.role.key === "CENTER_OWNER")
    .sort((a, b) => Number(a.role.key === "CENTER_OWNER") - Number(b.role.key === "CENTER_OWNER") || a.user.name.localeCompare(b.user.name));
  const day = tomorrowIst();
  return (
    <>
      <Breadcrumbs items={[{ href: "/console/imaging", label: "Scans" }, { label: "Scan rooms" }]} />
      <PageHeader
        eyebrow="Imaging"
        title="Scan rooms"
        description="Each X-ray, CT, MRI and ultrasound machine has its own slots. A slot needs a technician on shift. Maintenance blocks hide slots from patients. All times are IST."
      />
      {rooms.length === 0 ? <EmptyState title="No scan rooms yet" body="Add your first machine below. Then add a technician shift and create slots." /> : null}
      {rooms.map((room) => {
        const bookedSlots = room.slots.filter((slot) => slot.bookedCount > 0).length;
        return (
          <Panel
            key={room.id}
            title={`${room.name} · ${modalityLabel(room.modality)}`}
            description={`${room.branch.name} · ${room.room} · ${room.slotMinutes} min slots · ${room.active ? "In use" : "Out of use"}`}
            actions={manage ? (
              <ActionForm action={scanRoomAction}>
                <input type="hidden" name="op" value="active" />
                <input type="hidden" name="equipmentId" value={room.id} />
                <input type="hidden" name="active" value={room.active ? "false" : "true"} />
                <button className={button} type="submit">{room.active ? "Take out of use" : "Put back in use"}</button>
              </ActionForm>
            ) : null}
          >
            <div className="grid gap-4 lg:grid-cols-3">
              <section className="grid content-start gap-2" aria-label={`Technician shifts for ${room.name}`}>
                <h3 className="text-sm font-semibold">Technician shifts (next 7 days)</h3>
                {room.schedules.length === 0 ? <p className="text-sm text-muted-foreground">No shifts. Slots cannot be added without one.</p> : (
                  <ul className="grid gap-1 text-sm">
                    {room.schedules.map((shift) => (
                      <li key={shift.id} className="flex items-center justify-between gap-2">
                        <span>{formatDate(shift.startsAt)}, {formatTime(shift.startsAt)}–{formatTime(shift.endsAt)} · {shift.staff?.name ?? "Unassigned"}</span>
                        {manage ? (
                          <ActionForm action={scanRoomAction}>
                            <input type="hidden" name="op" value="unshift" />
                            <input type="hidden" name="shiftId" value={shift.id} />
                            <button className="text-xs text-destructive underline" type="submit">Remove</button>
                          </ActionForm>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
              <section className="grid content-start gap-2" aria-label={`Maintenance for ${room.name}`}>
                <h3 className="text-sm font-semibold">Maintenance blocks</h3>
                {room.blocks.length === 0 ? <p className="text-sm text-muted-foreground">No maintenance planned.</p> : (
                  <ul className="grid gap-1 text-sm">
                    {room.blocks.map((block) => (
                      <li key={block.id} className="flex items-center justify-between gap-2">
                        <span>{formatWhen(block.startsAt)} – {formatTime(block.endsAt)} · {block.reason}</span>
                        {manage ? (
                          <ActionForm action={scanRoomAction}>
                            <input type="hidden" name="op" value="unblock" />
                            <input type="hidden" name="blockId" value={block.id} />
                            <button className="text-xs text-destructive underline" type="submit">Remove</button>
                          </ActionForm>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
              <section className="grid content-start gap-2" aria-label={`Slots for ${room.name}`}>
                <h3 className="text-sm font-semibold">Slots (next 7 days): {room.slots.length}, {bookedSlots} with bookings</h3>
                {room.slots.length === 0 ? <p className="text-sm text-muted-foreground">No slots yet.</p> : (
                  <ul className="grid max-h-56 gap-1 overflow-y-auto text-sm">
                    {room.slots.map((slot) => {
                      const blocked = room.blocks.some((block) => block.startsAt < slot.endsAt && block.endsAt > slot.startsAt);
                      return (
                        <li key={slot.id} className="flex items-center justify-between gap-2">
                          <span>
                            {formatDate(slot.startsAt)}, {formatTime(slot.startsAt)} · {slot.bookedCount}/{slot.capacity} booked
                            {blocked ? <span className="ml-1 text-destructive">· blocked</span> : null}
                          </span>
                          {manage && slot.bookedCount === 0 ? (
                            <ActionForm action={scanRoomAction}>
                              <input type="hidden" name="op" value="unslot" />
                              <input type="hidden" name="slotId" value={slot.id} />
                              <button className="text-xs text-destructive underline" type="submit" aria-label={`Remove slot ${formatWhen(slot.startsAt)}`}>Remove</button>
                            </ActionForm>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            </div>
            {manage && room.active ? (
              <div className="mt-4 grid gap-3 border-t pt-4 lg:grid-cols-3">
                <ActionForm action={scanRoomAction} className="grid content-start gap-2">
                  <h3 className="text-sm font-semibold">Add a technician shift</h3>
                  <input type="hidden" name="op" value="shift" />
                  <input type="hidden" name="equipmentId" value={room.id} />
                  <label className="grid gap-1 text-xs">Technician
                    <select name="staffUserId" className={input} required>
                      {radiographers.map((member) => <option key={member.userId} value={member.userId}>{member.user.name}</option>)}
                    </select>
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <label className="grid gap-1 text-xs">Date<input type="date" name="day" defaultValue={day} className={input} required /></label>
                    <label className="grid gap-1 text-xs">From<input type="time" name="from" defaultValue="09:00" className={input} required /></label>
                    <label className="grid gap-1 text-xs">To<input type="time" name="to" defaultValue="13:00" className={input} required /></label>
                  </div>
                  <button className={button} type="submit">Add shift</button>
                </ActionForm>
                <ActionForm action={scanRoomAction} className="grid content-start gap-2">
                  <h3 className="text-sm font-semibold">Block for maintenance</h3>
                  <input type="hidden" name="op" value="block" />
                  <input type="hidden" name="equipmentId" value={room.id} />
                  <div className="grid grid-cols-3 gap-2">
                    <label className="grid gap-1 text-xs">Date<input type="date" name="day" defaultValue={day} className={input} required /></label>
                    <label className="grid gap-1 text-xs">From<input type="time" name="from" defaultValue="14:00" className={input} required /></label>
                    <label className="grid gap-1 text-xs">To<input type="time" name="to" defaultValue="16:00" className={input} required /></label>
                  </div>
                  <label className="grid gap-1 text-xs">Reason<input name="reason" placeholder="AMC service visit" className={input} required minLength={3} /></label>
                  <button className={button} type="submit">Add block</button>
                </ActionForm>
                <ActionForm action={scanRoomAction} className="grid content-start gap-2">
                  <h3 className="text-sm font-semibold">Create slots</h3>
                  <input type="hidden" name="op" value="slots" />
                  <input type="hidden" name="equipmentId" value={room.id} />
                  <div className="grid grid-cols-3 gap-2">
                    <label className="grid gap-1 text-xs">Date<input type="date" name="day" defaultValue={day} className={input} required /></label>
                    <label className="grid gap-1 text-xs">From<input type="time" name="from" defaultValue="09:00" className={input} required /></label>
                    <label className="grid gap-1 text-xs">To<input type="time" name="to" defaultValue="12:00" className={input} required /></label>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="grid gap-1 text-xs">Minutes each<input type="number" name="minutes" min={5} max={120} defaultValue={room.slotMinutes} className={input} /></label>
                    <label className="grid gap-1 text-xs">Patients per slot<input type="number" name="capacity" min={1} max={10} defaultValue={1} className={input} /></label>
                  </div>
                  <button className={primary} type="submit">Create slots</button>
                </ActionForm>
              </div>
            ) : null}
          </Panel>
        );
      })}
      {manage ? (
        <Panel title="Add a scan room" description="One entry per machine. Patients see its slots after you add a shift and create slots.">
          <ActionForm action={scanRoomAction} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 lg:items-end">
            <input type="hidden" name="op" value="room" />
            <label className="grid gap-1 text-xs">Branch
              <select name="branchId" className={input}>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select>
            </label>
            <label className="grid gap-1 text-xs">Scan type
              <select name="modality" className={input}>{Object.entries(SCAN_MODALITIES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
            </label>
            <label className="grid gap-1 text-xs">Machine name<input name="name" placeholder="CT 128-slice" className={input} required /></label>
            <label className="grid gap-1 text-xs">Room<input name="room" placeholder="Ground floor, Room 3" className={input} required /></label>
            <label className="grid gap-1 text-xs">Minutes per slot<input type="number" name="slotMinutes" min={5} max={120} defaultValue={20} className={input} /></label>
            <button className={primary} type="submit">Add scan room</button>
          </ActionForm>
        </Panel>
      ) : <p className="text-sm text-muted-foreground">Only radiology staff and managers can change scan rooms.</p>}
    </>
  );
}
