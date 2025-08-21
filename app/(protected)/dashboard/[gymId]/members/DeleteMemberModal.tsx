"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogDescription } from "@/components/ui/dialog";
import { deleteMember } from "./actions";
import type { Member } from "@prisma/client";

interface DeleteMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  member: Member;
  gymId: string;
}

export function DeleteMemberModal({ isOpen, onClose, member, gymId }: DeleteMemberModalProps) {
  const [isPending, startTransition] = useTransition();
  
  const handleDelete = () => {
    startTransition(() => {
      toast.promise(deleteMember(member.id, gymId), {
        loading: 'Deleting member...',
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
          <DialogTitle>Are you sure?</DialogTitle>
          <DialogDescription>
            This will permanently delete <strong>{member.name}</strong>. This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
          <Button variant="destructive" onClick={handleDelete} disabled={isPending}>{isPending ? "Deleting..." : "Confirm Delete"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
