./clean-build.sh


"use client";

import { useForm, SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { format } from "date-fns";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { updateMember } from "./actions";
import type { Member, MembershipPlan, CustomField } from "@prisma/client";

// Zod schema for form validation
const memberFormSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters." }),
  email: z.string().email({ message: "Please enter a valid email." }),
  phone: z.string().optional(),
  address: z.string().optional(),
  gender: z.string().optional(),
  dateOfBirth: z.string().optional(),
  joinedAt: z.string().min(1, { message: "Joining date is required." }),
  weightKg: z.preprocess((val) => (val === "" ? undefined : val), z.coerce.number().optional()),
  heightCm: z.preprocess((val) => (val === "" ? undefined : val), z.coerce.number().optional()),
  planId: z.string().min(1, { message: "Please select a plan." }),
  photoUrl: z.any().optional(),
  idProofUrl: z.any().optional(),
});

type MemberFormData = z.infer<typeof memberFormSchema>;
type MemberWithPlan = Member & { plan: MembershipPlan };

interface EditMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  member: MemberWithPlan;
  gymId: string;
  membershipPlans: MembershipPlan[];
  customFields: CustomField[];
  isProPlan: boolean;
}

export function EditMemberModal({ 
  isOpen, 
  onClose, 
  member, 
  gymId, 
  membershipPlans, 
  customFields, 
  isProPlan 
}: EditMemberModalProps) {
  const form = useForm<MemberFormData>({
    resolver: zodResolver(memberFormSchema),
    defaultValues: {
      name: member.name,
      email: member.email,
      phone: member.phone ?? "",
      address: member.address ?? "",
      gender: member.gender ?? "",
      dateOfBirth: member.dateOfBirth ? format(new Date(member.dateOfBirth), "yyyy-MM-dd") : "",
      joinedAt: format(new Date(member.joinedAt), "yyyy-MM-dd"),
      planId: member.planId,
      weightKg: member.weightKg ?? undefined,
      heightCm: member.heightCm ?? undefined,
    },
  });
  const { isSubmitting } = form.formState;

  const onSubmit: SubmitHandler<MemberFormData> = async (data) => {
    const formData = new FormData();
    Object.entries(data).forEach(([key, value]) => {
      if (key === 'photoUrl' || key === 'idProofUrl') {
        if (value instanceof FileList && value.length > 0) formData.append(key, value[0]);
      } else if (value != null) formData.append(key, String(value));
    });

    // Add custom fields to formData
    customFields.forEach(field => {
      const customValue = (data as any)[`custom_${field.id}`];
      if (customValue) {
        formData.append(`custom_${field.id}`, customValue);
      }
    });

    toast.promise(updateMember(member.id, gymId, formData), {
      loading: 'Updating member...',
      success: (result) => { 
        onClose(); 
        return result.message; 
      },
      error: (result) => result.message || "An error occurred.",
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Edit Member Details</DialogTitle></DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="grid grid-cols-2 gap-4 py-4 pr-6">
          <div className="col-span-2 font-semibold">Personal Details</div>
          <div><label>Full Name</label><Input {...form.register("name")} />{form.formState.errors.name && <p className="text-red-500 text-xs mt-1">{form.formState.errors.name.message}</p>}</div>
          <div><label>Email</label><Input type="email" {...form.register("email")} />{form.formState.errors.email && <p className="text-red-500 text-xs mt-1">{form.formState.errors.email.message}</p>}</div>
          <div><label>Phone</label><Input {...form.register("phone")} /></div>
          <div><label>Gender</label><Select onValueChange={(v) => form.setValue("gender", v)} defaultValue={form.getValues("gender")}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Male">Male</SelectItem><SelectItem value="Female">Female</SelectItem><SelectItem value="Other">Other</SelectItem></SelectContent></Select></div>
          <div><label>Date of Birth</label><Input type="date" {...form.register("dateOfBirth")} /></div>
          <div><label>Joining Date</label><Input type="date" {...form.register("joinedAt")} disabled={!isProPlan} />{form.formState.errors.joinedAt && <p className="text-red-500 text-xs mt-1">{form.formState.errors.joinedAt.message}</p>}</div>
          <div><label>Weight (kg)</label><Input type="number" step="0.1" {...form.register("weightKg")} /></div>
          <div><label>Height (cm)</label><Input type="number" step="0.1" {...form.register("heightCm")} /></div>
          <div className="col-span-2"><label>Address</label><Textarea {...form.register("address")} /></div>
          
          {isProPlan && customFields.length > 0 && (
            <>
              <div className="col-span-2 font-semibold mt-4">Additional Information</div>
              {customFields.map(field => (
                <div key={field.id}>
                  <label>{field.name}{field.required && <span className="text-red-500">*</span>}</label>
                  <Input name={`custom_${field.id}`} type={field.type} required={field.required} defaultValue={(member.customFields as any)?.[field.name] || ''} />
                </div>
              ))}
            </>
          )}

          <div className="col-span-2 font-semibold mt-4">Documents</div>
          <div><label>Member Photo</label><Input type="file" accept="image/*" {...form.register("photoUrl")} /></div>
          <div><label>ID Proof</label><Input type="file" {...form.register("idProofUrl")} /></div>
          <div className="col-span-2 font-semibold mt-4">Membership</div>
          <div className="col-span-2"><label>Membership Plan</label><Select onValueChange={(v) => form.setValue("planId", v)} defaultValue={form.getValues("planId")} disabled={!isProPlan}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{membershipPlans.map(plan => <SelectItem key={plan.id} value={plan.id}>{plan.name}</SelectItem>)}</SelectContent></Select>{form.formState.errors.planId && <p className="text-red-500 text-xs mt-1">{form.formState.errors.planId.message}</p>}</div>
          <DialogFooter className="col-span-2 mt-4"><DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose><Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Saving..." : "Save Changes"}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
