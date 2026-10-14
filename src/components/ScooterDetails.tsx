import { Check, Phone, X } from "lucide-react";
import { WhatsAppIcon } from "@/components/WhatsAppIcon";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { BRAND } from "@/lib/brand";
import { SALE_EXTRAS, enquire, type SaleScooter } from "@/lib/scooters";

/** "View Details" popup for a scooter for sale, listing the extras it comes with. */
export function ScooterDetails({ scooter, onClose }: { scooter: SaleScooter | null; onClose: () => void }) {
  return (
    <DialogPrimitive.Root open={!!scooter} onOpenChange={(o) => !o && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="ss-dialog-overlay" />
        <DialogPrimitive.Content className="ss-dialog">
          {scooter && (
            <>
              <DialogPrimitive.Close className="ss-dialog-close" aria-label="Close">
                <X />
              </DialogPrimitive.Close>
              <div className="ss-dialog-photo">
                <img src={scooter.image} alt={scooter.name} />
              </div>
              <div className="ss-dialog-body">
                <p className="ss-eyebrow">For sale · {scooter.cc}</p>
                <DialogPrimitive.Title className="ss-dialog-title">{scooter.name}</DialogPrimitive.Title>
                <DialogPrimitive.Description className="ss-dialog-text">{scooter.body}</DialogPrimitive.Description>
                <h3 className="ss-dialog-subtitle">Comes with</h3>
                <ul className="ss-extras">
                  {SALE_EXTRAS.map((x) => (
                    <li key={x}>
                      <Check aria-hidden="true" />
                      {x}
                    </li>
                  ))}
                </ul>
                <div className="ss-dialog-actions">
                  <a href={enquire.buy(scooter.name)} target="_blank" rel="noopener noreferrer" className="ss-btn-whatsapp">
                    <WhatsAppIcon aria-hidden="true" /> Enquire on WhatsApp
                  </a>
                  <a href={`tel:+${BRAND.phoneIntl}`} className="ss-btn-dark">
                    <Phone aria-hidden="true" /> Call {BRAND.phone}
                  </a>
                </div>
              </div>
            </>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
