"use client";

import { useState } from "react";
import { PlusCircle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import type { Member, MembershipPlan, CustomField } from "@prisma/client";
import { MembersTable } from "./MembersTable";
import { AddMemberModal } from "./AddMemberModal";
import { EditMemberModal } from "./EditMemberModal";
import { RenewMemberModal } from "./RenewMemberModal";
import { DeleteMemberModal } from "./DeleteMemberModal";

type MemberWithPlan = Member & { plan: MembershipPlan };

interface MembersClientProps {
  initialMembers: MemberWithPlan[];
  membershipPlans: MembershipPlan[];
  customFields: CustomField[];
  gymId: string;
  isProPlan: boolean;
}

export function MembersClient({
  initialMembers,
  membershipPlans,
  customFields,
  gymId,
  isProPlan,
}: MembersClientProps) {
  const [isAddModalOpen, setAddModalOpen] = useState(false);
  const [isEditModalOpen, setEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setDeleteModalOpen] = useState(false);
  const [isRenewModalOpen, setRenewModalOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<MemberWithPlan | null>(
    null
  );

  // Initialize shareablePlanId with the first plan's ID or undefined if no plans exist
  const [shareablePlanId, setShareablePlanId] = useState<string | undefined>(
    membershipPlans[0]?.id
  );

  // Generate share link, default to empty string if no plan is selected
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const shareLink = shareablePlanId
    ? `${origin}/join/${gymId}?plan=${shareablePlanId}`
    : "";

  const copyToClipboard = () => {
    if (!shareLink) {
      toast.error("No plan selected to generate a share link.");
      return;
    }
    navigator.clipboard.writeText(shareLink);
    toast.success("Signup link copied!");
  };

  const handleEdit = (member: MemberWithPlan) => {
    setSelectedMember(member);
    setEditModalOpen(true);
  };

  const handleDelete = (member: MemberWithPlan) => {
    setSelectedMember(member);
    setDeleteModalOpen(true);
  };

  const handleRenew = (member: MemberWithPlan) => {
    setSelectedMember(member);
    setRenewModalOpen(true);
  };

  return (
    <div>
      <div className="flex justify-end mb-4">
        <Button
          onClick={() => setAddModalOpen(true)}
          disabled={membershipPlans.length === 0}
        >
          <PlusCircle className="mr-2 h-4 w-4" /> Add Member
        </Button>
      </div>

      <MembersTable
        initialMembers={initialMembers}
        gymId={gymId}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onRenew={handleRenew}
      />

      <AddMemberModal
        isOpen={isAddModalOpen}
        onClose={() => setAddModalOpen(false)}
        gymId={gymId}
        membershipPlans={membershipPlans}
        customFields={customFields}
        isProPlan={isProPlan}
        shareLink={shareLink}
        shareablePlanId={shareablePlanId}
        setShareablePlanId={setShareablePlanId}
        copyToClipboard={copyToClipboard}
      />

      {selectedMember && (
        <EditMemberModal
          isOpen={isEditModalOpen}
          onClose={() => {
            setEditModalOpen(false);
            setSelectedMember(null);
          }}
          member={selectedMember}
          gymId={gymId}
          membershipPlans={membershipPlans}
          customFields={customFields}
          isProPlan={isProPlan}
        />
      )}

      {selectedMember && (
        <RenewMemberModal
          isOpen={isRenewModalOpen}
          onClose={() => {
            setRenewModalOpen(false);
            setSelectedMember(null);
          }}
          member={selectedMember}
          gymId={gymId}
          membershipPlans={membershipPlans}
          isProPlan={isProPlan}
        />
      )}

      {selectedMember && (
        <DeleteMemberModal
          isOpen={isDeleteModalOpen}
          onClose={() => {
            setDeleteModalOpen(false);
            setSelectedMember(null);
          }}
          member={selectedMember}
          gymId={gymId}
        />
      )}
    </div>
  );
}
