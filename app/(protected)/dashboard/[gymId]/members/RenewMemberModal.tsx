"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { renewMembership } from "./actions";
import type { Member, MembershipPlan } from "@prisma/client";

type MemberWithPlan = Member & { plan: MembershipPlan };

interface RenewMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  member: MemberWithPlan;
  gymId: string;
  membershipPlans: MembershipPlan[];
  isProPlan: boolean;
}

export function RenewMemberModal({ isOpen, onClose, member, gymId, membershipPlans, isProPlan }: RenewMemberModalProps) {
  const [isPending, startTransition] = useTransition();
  const [renewalPlanId, setRenewalPlanId] = useState(member.planId);

  const handleRenew = () => {
    startTransition(() => {
      toast.promise(renewMembership(member.id, gymId, renewalPlanId), {
        loading: 'Renewing membership...',
        success: (result) => { 
          onClose(); 
          return result.message; 
        },
        error: (result) => result.message || "An error occurred.",
      });
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Renew Membership</DialogTitle>
          <DialogDescription>
            Extend the membership for <strong>{member.name}</strong>.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div>
            <label>Membership Plan</label>
            <Select onValueChange={setRenewalPlanId} defaultValue={renewalPlanId} disabled={!isProPlan}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{membershipPlans.map(plan => <SelectItem key={plan.id} value={plan.id}>{plan.name}</SelectItem>)}</SelectContent>
            </Select>
            {!isProPlan && <p className="text-xs text-muted-foreground mt-1">Upgrade to Pro to change plans upon renewal.</p>}
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
          <Button onClick={handleRenew} disabled={isPending}>{isPending ? "Renewing..." : "Confirm Renewal"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
