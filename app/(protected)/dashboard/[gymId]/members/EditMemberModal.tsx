"use client";

import { useForm, SubmitHandler, Controller } from "react-hook-form";
import { toast } from "sonner";
import { format } from "date-fns";
import { Upload, X, Loader2 } from "lucide-react";
import { useState, useCallback, useMemo, useEffect } from "react"; // Added useEffect
import { useDebounce } from "use-debounce"; // Added for debouncing

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { updateMember, checkEmailAvailability } from "./actions"; // Added checkEmailAvailability
import type { Member, MembershipPlan, CustomField } from "@prisma/client";

// Define types for server action responses
interface CheckEmailResponse {
  success: boolean;
  available?: boolean;
  message?: string;
  errorCode?: string;
}

interface UpdateMemberResponse {
  success: boolean;
  message: string;
  errorCode?: string;
  errors?: Record<string, string[]>;
}

interface MemberFormData {
  name: string;
  email: string;
  planId: string;
  joinedAt: string;
  phone?: string;
  address?: string;
  dateOfBirth?: string;
  gender?: string;
  weightKg?: string;
  heightCm?: string;
  photoUrl?: FileList;
  idProofUrl?: FileList;
  [key: string]: any;
}

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

interface FileUploadState {
  photo: { file: File | null; preview: string | null; error: string | null };
  idProof: { file: File | null; preview: string | null; error: string | null };
}

export function EditMemberModal({
  isOpen,
  onClose,
  member,
  gymId,
  membershipPlans,
  customFields,
  isProPlan,
}: EditMemberModalProps) {
  const [uploadProgress, setUploadProgress] = useState(0);
  const [fileUploadState, setFileUploadState] = useState<FileUploadState>({
    photo: { file: null, preview: null, error: null },
    idProof: { file: null, preview: null, error: null },
  });
  const [isCheckingEmail, setIsCheckingEmail] = useState(false); // Added for email validation
  const [emailAvailable, setEmailAvailable] = useState<boolean | null>(null); // Added to track email availability
  const [emailInput, setEmailInput] = useState(member.email); // Initialize with member's email
  const [debouncedEmail] = useDebounce(emailInput, 500); // Debounce email input

  // Helper function to construct full image URLs
  const getFullImageUrl = useCallback(
    (url: string | null): string | null => {
      if (!url) return null;

      if (url.startsWith("http://") || url.startsWith("https://")) {
        return url;
      }

      if (url.startsWith("/")) {
        return `${window.location.origin}${url}`;
      }

      if (url.includes("/uploads/") || url.includes(`${gymId}/`)) {
        const cleanUrl = url.startsWith("/") ? url : `/${url}`;
        return `${window.location.origin}${cleanUrl}`;
      }

      return `${window.location.origin}/uploads/${gymId}/${url}`;
    },
    [gymId]
  );

  // Memoize default values with member data
  const defaultValues = useMemo(() => {
    const customFieldValues: Record<string, any> = {};

    if (isProPlan && customFields.length > 0) {
      const customData = member.customFields as any;
      customFields.forEach((field) => {
        customFieldValues[`custom_${field.id}`] =
          customData?.[field.name] || "";
      });
    }

    return {
      name: member.name,
      email: member.email,
      phone: member.phone || "",
      address: member.address || "",
      gender: member.gender || "not_specified",
      dateOfBirth: member.dateOfBirth
        ? format(new Date(member.dateOfBirth), "yyyy-MM-dd")
        : "",
      joinedAt: format(new Date(member.joinedAt), "yyyy-MM-dd"),
      planId: member.planId,
      weightKg: member.weightKg ? String(member.weightKg) : "",
      heightCm: member.heightCm ? String(member.heightCm) : "",
      ...customFieldValues,
    };
  }, [member, customFields, isProPlan]);

  const form = useForm<MemberFormData>({
    defaultValues,
    mode: "onChange",
  });

  const { isSubmitting, errors } = form.formState;

  // Real-time email validation
  useEffect(() => {
    if (debouncedEmail && debouncedEmail !== member.email) {
      // Skip if email hasn't changed
      setIsCheckingEmail(true);
      const checkEmail = async () => {
        try {
          const response: CheckEmailResponse = await checkEmailAvailability(
            gymId,
            debouncedEmail
          );
          setIsCheckingEmail(false);
          if (response.success && typeof response.available === "boolean") {
            setEmailAvailable(response.available);
            if (!response.available) {
              form.setError("email", {
                type: "manual",
                message:
                  "This email is already registered for another member in this gym.",
              });
            } else {
              form.clearErrors("email");
            }
          } else if (!response.success) {
            toast.error(
              response.message || "Failed to check email availability."
            );
            setEmailAvailable(null);
          }
        } catch (error) {
          setIsCheckingEmail(false);
          toast.error("Failed to check email availability.");
          setEmailAvailable(null);
        }
      };
      checkEmail();
    } else {
      setIsCheckingEmail(false);
      setEmailAvailable(null);
      form.clearErrors("email");
    }
  }, [debouncedEmail, gymId, form, member.email]);

  // File validation helper
  const validateFile = useCallback(
    (file: File, type: "photo" | "idProof"): string | null => {
      const maxSize = 5 * 1024 * 1024; // 5MB
      const allowedTypes =
        type === "photo"
          ? ["image/jpeg", "image/png", "image/webp"]
          : ["image/jpeg", "image/png", "image/webp", "application/pdf"];

      if (file.size > maxSize) {
        return `File too large. Maximum size is 5MB.`;
      }

      if (!allowedTypes.includes(file.type)) {
        return `Invalid file type. ${
          type === "photo" ? "Only images" : "Only images and PDFs"
        } are allowed.`;
      }

      return null;
    },
    []
  );

  // Handle file selection with validation and preview
  const handleFileSelect = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>, type: "photo" | "idProof") => {
      const file = event.target.files?.[0];

      if (!file) {
        setFileUploadState((prev) => ({
          ...prev,
          [type]: { file: null, preview: null, error: null },
        }));
        return;
      }

      const error = validateFile(file, type);

      if (error) {
        setFileUploadState((prev) => ({
          ...prev,
          [type]: { file: null, preview: null, error },
        }));
        toast.error(error);
        return;
      }

      let preview: string | null = null;
      if (file.type.startsWith("image/")) {
        preview = URL.createObjectURL(file);
      }

      setFileUploadState((prev) => ({
        ...prev,
        [type]: { file, preview, error: null },
      }));

      const fileList = new DataTransfer();
      fileList.items.add(file);
      form.setValue(
        type === "photo" ? "photoUrl" : "idProofUrl",
        fileList.files
      );
    },
    [validateFile, form]
  );

  // Remove file
  const removeFile = useCallback(
    (type: "photo" | "idProof") => {
      setFileUploadState((prev) => {
        if (prev[type].preview) {
          URL.revokeObjectURL(prev[type].preview!);
        }
        return {
          ...prev,
          [type]: { file: null, preview: null, error: null },
        };
      });
      form.setValue(type === "photo" ? "photoUrl" : "idProofUrl", undefined);
    },
    [form]
  );

  const onSubmit: SubmitHandler<MemberFormData> = async (data) => {
    // Prevent submission if email is not available
    if (emailAvailable === false) {
      toast.error("Please use a different email address.");
      return;
    }

    try {
      setUploadProgress(10);
      console.log("=== EDIT MEMBER FORM SUBMIT ===");

      // Client-side validation
      const validationErrors: string[] = [];

      if (!data.name?.trim() || data.name.trim().length < 2) {
        validationErrors.push("Name must be at least 2 characters");
      }

      if (
        !data.email?.trim() ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email.trim())
      ) {
        validationErrors.push("Please enter a valid email address");
      }

      if (!data.planId) {
        validationErrors.push("Please select a membership plan");
      }

      if (!data.joinedAt) {
        validationErrors.push("Please select a joining date");
      }

      if (fileUploadState.photo.error) {
        validationErrors.push(fileUploadState.photo.error);
      }
      if (fileUploadState.idProof.error) {
        validationErrors.push(fileUploadState.idProof.error);
      }

      if (validationErrors.length > 0) {
        validationErrors.forEach((error) => toast.error(error));
        setUploadProgress(0);
        return;
      }

      setUploadProgress(30);

      // Prepare FormData
      const formData = new FormData();

      formData.append("name", data.name.trim());
      formData.append("email", data.email.toLowerCase().trim());
      formData.append("planId", data.planId);
      formData.append("joinedAt", data.joinedAt);

      const optionalFields = [
        { key: "phone", value: data.phone?.trim() },
        { key: "address", value: data.address?.trim() },
        { key: "gender", value: data.gender?.trim() },
        { key: "dateOfBirth", value: data.dateOfBirth },
      ];

      optionalFields.forEach(({ key, value }) => {
        if (value && value !== "") {
          formData.append(key, value);
        }
      });

      if (
        data.weightKg &&
        !isNaN(Number(data.weightKg)) &&
        Number(data.weightKg) > 0
      ) {
        formData.append("weightKg", data.weightKg);
      }
      if (
        data.heightCm &&
        !isNaN(Number(data.heightCm)) &&
        Number(data.heightCm) > 0
      ) {
        formData.append("heightCm", data.heightCm);
      }

      setUploadProgress(50);

      if (fileUploadState.photo.file) {
        formData.append("photoUrl", fileUploadState.photo.file);
      }
      if (fileUploadState.idProof.file) {
        formData.append("idProofUrl", fileUploadState.idProof.file);
      }

      if (isProPlan && customFields.length > 0) {
        customFields.forEach((field) => {
          const customValue = data[`custom_${field.id}`];
          if (customValue != null && customValue !== "") {
            formData.append(`custom_${field.id}`, String(customValue));
          }
        });
      }

      setUploadProgress(70);

      console.log("Updating member with files:", {
        photo: fileUploadState.photo.file?.name,
        idProof: fileUploadState.idProof.file?.name,
        formDataSize: Array.from(formData.entries()).length,
      });

      const result: UpdateMemberResponse = await updateMember(
        member.id,
        gymId,
        formData
      );

      setUploadProgress(100);
      console.log("Server action result:", result);

      if (result.success) {
        toast.success(result.message);
        handleModalClose();
      } else {
        toast.error(result.message);

        if (result.errorCode === "EMAIL_ALREADY_EXISTS") {
          form.setError("email", {
            type: "manual",
            message:
              "This email is already registered for another member in this gym.",
          });
        }

        if (result.errors) {
          Object.entries(result.errors).forEach(([field, messages]) => {
            if (Array.isArray(messages) && messages.length > 0) {
              toast.error(`${field}: ${messages[0]}`);
            }
          });
        }
      }
    } catch (error: any) {
      console.error("Form submission error:", error);
      toast.error("An unexpected error occurred. Please try again.");
    } finally {
      setUploadProgress(0);
    }
  };

  const handleModalClose = useCallback(() => {
    if (fileUploadState.photo.preview) {
      URL.revokeObjectURL(fileUploadState.photo.preview);
    }
    if (fileUploadState.idProof.preview) {
      URL.revokeObjectURL(fileUploadState.idProof.preview);
    }

    setFileUploadState({
      photo: { file: null, preview: null, error: null },
      idProof: { file: null, preview: null, error: null },
    });

    setEmailAvailable(null); // Reset email validation
    setIsCheckingEmail(false);
    setEmailInput(member.email); // Reset to original email

    form.reset(defaultValues);
    setUploadProgress(0);
    onClose();
  }, [fileUploadState, form, defaultValues, onClose, member.email]);

  // File upload component with enhanced current file display
  const FileUploadField = ({
    type,
    label,
    accept,
    currentFileUrl,
  }: {
    type: "photo" | "idProof";
    label: string;
    accept: string;
    currentFileUrl?: string | null;
  }) => {
    const fileState = fileUploadState[type];
    const [imageError, setImageError] = useState(false);

    const fullImageUrl = getFullImageUrl(currentFileUrl ?? null);

    const isImage =
      fullImageUrl &&
      !imageError &&
      (fullImageUrl.toLowerCase().includes(".jpg") ||
        fullImageUrl.toLowerCase().includes(".jpeg") ||
        fullImageUrl.toLowerCase().includes(".png") ||
        fullImageUrl.toLowerCase().includes(".webp") ||
        fullImageUrl.includes("image/") ||
        fullImageUrl.startsWith("data:image"));

    const isPdf =
      fullImageUrl &&
      (fullImageUrl.toLowerCase().includes(".pdf") ||
        fullImageUrl.includes("application/pdf"));

    console.log("FileUpload Debug:", {
      type,
      originalUrl: currentFileUrl,
      fullImageUrl,
      isImage,
      imageError,
    });

    return (
      <div className="space-y-3">
        <label className="text-sm font-medium">{label}</label>

        {fullImageUrl && !fileState.file && (
          <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
            {isImage && !imageError ? (
              <div className="relative group">
                <img
                  src={fullImageUrl}
                  alt={`Current ${label.toLowerCase()}`}
                  className="w-full h-48 object-cover bg-gray-100"
                  onError={() => setImageError(true)}
                  onLoad={() => setImageError(false)}
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all duration-200 flex items-center justify-center">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                    onClick={() => window.open(fullImageUrl, "_blank")}
                  >
                    View Full Size
                  </Button>
                </div>
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-3">
                  <p className="text-white text-xs font-medium">
                    Current {label}
                  </p>
                </div>
              </div>
            ) : isPdf ? (
              <div className="p-6 text-center bg-red-50">
                <div className="w-16 h-16 mx-auto mb-3 bg-red-100 rounded-lg flex items-center justify-center">
                  <svg
                    className="w-8 h-8 text-red-600"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <p className="text-sm font-medium text-red-700 mb-2">
                  Current PDF Document
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(fullImageUrl, "_blank")}
                >
                  View PDF
                </Button>
              </div>
            ) : (
              <div className="p-6 text-center bg-gray-50">
                <div className="w-16 h-16 mx-auto mb-3 bg-gray-200 rounded-lg flex items-center justify-center">
                  {type === "photo" ? (
                    <svg
                      className="w-8 h-8 text-gray-500"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                  ) : (
                    <svg
                      className="w-8 h-8 text-gray-500"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                </div>
                <p className="text-sm font-medium text-gray-700 mb-2">
                  Current {label}
                  {imageError && type === "photo" && (
                    <span className="block text-xs text-red-500 mt-1">
                      (Image could not be loaded)
                    </span>
                  )}
                </p>
                <div className="text-xs text-gray-500 mb-2 font-mono bg-gray-100 p-2 rounded border break-all">
                  URL: {fullImageUrl}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(fullImageUrl, "_blank")}
                >
                  View File
                </Button>
              </div>
            )}

            <div className="p-3 border-t bg-gray-50">
              <Input
                type="file"
                accept={accept}
                onChange={(e) => handleFileSelect(e, type)}
                className="hidden"
                id={`file-${type}-replace`}
              />
              <label
                htmlFor={`file-${type}-replace`}
                className="cursor-pointer"
              >
                <div className="flex items-center justify-center space-x-2 text-blue-600 hover:text-blue-700 transition-colors">
                  <Upload className="h-4 w-4" />
                  <span className="text-sm font-medium">Replace {label}</span>
                </div>
              </label>
            </div>
          </div>
        )}

        {!fullImageUrl && !fileState.file && (
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors">
            <Upload className="mx-auto h-12 w-12 text-gray-400 mb-3" />
            <Input
              type="file"
              accept={accept}
              onChange={(e) => handleFileSelect(e, type)}
              className="hidden"
              id={`file-${type}`}
            />
            <label htmlFor={`file-${type}`} className="cursor-pointer">
              <span className="text-sm text-gray-600 font-medium">
                Upload {label.toLowerCase()}
              </span>
              <br />
              <span className="text-xs text-gray-400 mt-1 block">
                Max 5MB •{" "}
                {type === "photo" ? "JPG, PNG, WebP" : "JPG, PNG, WebP, PDF"}
              </span>
            </label>
          </div>
        )}

        {fileState.file && (
          <div className="border rounded-lg overflow-hidden bg-white">
            {fileState.preview ? (
              <div className="relative">
                <img
                  src={fileState.preview}
                  alt="New file preview"
                  className="w-full h-48 object-cover bg-gray-100"
                />
                <div className="absolute top-2 right-2">
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={() => removeFile(type)}
                    className="h-8 w-8 p-0 shadow-lg"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-3">
                  <p className="text-white text-xs font-medium">New {label}</p>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-blue-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <svg
                        className="w-5 h-5 text-blue-600"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-blue-900 truncate">
                        {fileState.file.name}
                      </p>
                      <p className="text-xs text-blue-600">
                        {(fileState.file.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeFile(type)}
                    className="flex-shrink-0"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {fileState.error && (
          <Alert variant="destructive">
            <AlertDescription>{fileState.error}</AlertDescription>
          </Alert>
        )}
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleModalClose}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>Edit Member Details</DialogTitle>
        </DialogHeader>

        {uploadProgress > 0 && (
          <div className="space-y-2">
            <Progress value={uploadProgress} className="h-2" />
            <p className="text-xs text-center text-muted-foreground">
              {uploadProgress < 50
                ? "Validating..."
                : uploadProgress < 90
                ? "Updating..."
                : "Finalizing..."}
            </p>
          </div>
        )}

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4 max-h-[60vh] overflow-y-auto pr-2 space-y-4">
            <div className="col-span-2 font-semibold text-lg border-b pb-2 text-blue-600">
              Personal Details
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">
                Full Name <span className="text-red-500">*</span>
              </label>
              <Input
                {...form.register("name", {
                  required: "Name is required",
                  minLength: {
                    value: 2,
                    message: "Name must be at least 2 characters",
                  },
                  pattern: {
                    value: /^[a-zA-Z\s]+$/,
                    message: "Name should only contain letters and spaces",
                  },
                })}
                placeholder="Enter full name"
                className={errors.name ? "border-red-500" : ""}
              />
              {errors.name && (
                <span className="text-xs text-red-500">
                  {errors.name.message}
                </span>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">
                Email <span className="text-red-500">*</span>
              </label>
              <Input
                type="email"
                {...form.register("email", {
                  required: "Email is required",
                  pattern: {
                    value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                    message: "Invalid email format",
                  },
                })}
                onChange={(e) => {
                  form.setValue("email", e.target.value);
                  setEmailInput(e.target.value);
                }}
                placeholder="Enter email address"
                className={errors.email ? "border-red-500" : ""}
              />
              {isCheckingEmail && (
                <span className="text-xs text-gray-500">Checking...</span>
              )}
              {errors.email && (
                <span className="text-xs text-red-500">
                  {errors.email.message}
                </span>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Phone</label>
              <Input
                {...form.register("phone", {
                  pattern: {
                    value: /^[+]?[\d\s-()]+$/,
                    message: "Invalid phone number format",
                  },
                })}
                placeholder="Enter phone number"
                className={errors.phone ? "border-red-500" : ""}
              />
              {errors.phone && (
                <span className="text-xs text-red-500">
                  {errors.phone.message}
                </span>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Gender</label>
              <Controller
                name="gender"
                control={form.control}
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select gender" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="not_specified">
                        Not specified
                      </SelectItem>
                      <SelectItem value="Male">Male</SelectItem>
                      <SelectItem value="Female">Female</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Date of Birth</label>
              <Input
                type="date"
                {...form.register("dateOfBirth", {
                  validate: (value) => {
                    if (!value) return true;
                    const birthDate = new Date(value);
                    const today = new Date();
                    const age = today.getFullYear() - birthDate.getFullYear();
                    return (
                      (age >= 10 && age <= 100) ||
                      "Please enter a valid birth date"
                    );
                  },
                })}
                max={format(new Date(), "yyyy-MM-dd")}
              />
              {errors.dateOfBirth && (
                <span className="text-xs text-red-500">
                  {errors.dateOfBirth.message}
                </span>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">
                Joining Date <span className="text-red-500">*</span>
                {!isProPlan && (
                  <span className="text-gray-500 ml-2">
                    (Pro plan required to edit)
                  </span>
                )}
              </label>
              <Input
                type="date"
                {...form.register("joinedAt", {
                  required: "Joining date is required",
                })}
                disabled={!isProPlan}
                className={errors.joinedAt ? "border-red-500" : ""}
              />
              {errors.joinedAt && (
                <span className="text-xs text-red-500">
                  {errors.joinedAt.message}
                </span>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Weight (kg)</label>
              <Input
                type="number"
                step="0.1"
                min="20"
                max="300"
                {...form.register("weightKg", {
                  validate: (value) => {
                    if (!value) return true;
                    const weight = Number(value);
                    return (
                      (weight >= 20 && weight <= 300) ||
                      "Weight must be between 20-300 kg"
                    );
                  },
                })}
                placeholder="Enter weight"
              />
              {errors.weightKg && (
                <span className="text-xs text-red-500">
                  {errors.weightKg.message}
                </span>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Height (cm)</label>
              <Input
                type="number"
                step="0.1"
                min="100"
                max="250"
                {...form.register("heightCm", {
                  validate: (value) => {
                    if (!value) return true;
                    const height = Number(value);
                    return (
                      (height >= 100 && height <= 250) ||
                      "Height must be between 100-250 cm"
                    );
                  },
                })}
                placeholder="Enter height"
              />
              {errors.heightCm && (
                <span className="text-xs text-red-500">
                  {errors.heightCm.message}
                </span>
              )}
            </div>

            <div className="col-span-2 space-y-2">
              <label className="text-sm font-medium">Address</label>
              <Textarea
                {...form.register("address")}
                placeholder="Enter complete address"
                rows={2}
              />
            </div>

            {isProPlan && customFields.length > 0 && (
              <>
                <div className="col-span-2 font-semibold text-lg border-b pb-2 mt-4 text-blue-600">
                  Additional Information
                </div>
                {customFields.map((field) => (
                  <div key={field.id} className="space-y-2">
                    <label className="text-sm font-medium">
                      {field.name}
                      {field.required && (
                        <span className="text-red-500 ml-1">*</span>
                      )}
                    </label>
                    <Input
                      {...form.register(`custom_${field.id}`, {
                        required: field.required
                          ? `${field.name} is required`
                          : false,
                      })}
                      type={field.type}
                      placeholder={`Enter ${field.name.toLowerCase()}`}
                      className={
                        errors[`custom_${field.id}`] ? "border-red-500" : ""
                      }
                    />
                    {errors[`custom_${field.id}`] && (
                      <span className="text-xs text-red-500">
                        {String(errors[`custom_${field.id}`]?.message)}
                      </span>
                    )}
                  </div>
                ))}
              </>
            )}

            <div className="col-span-2 font-semibold text-lg border-b pb-2 mt-4 text-blue-600">
              Documents
            </div>

            <FileUploadField
              type="photo"
              label="Member Photo"
              accept="image/*"
              currentFileUrl={member.photoUrl}
            />

            <FileUploadField
              type="idProof"
              label="ID Proof"
              accept="image/*,.pdf"
              currentFileUrl={member.idProofUrl}
            />

            <div className="col-span-2 font-semibold text-lg border-b pb-2 mt-4 text-blue-600">
              Membership Details
            </div>

            <div className="col-span-2 space-y-2">
              <label className="text-sm font-medium">
                Membership Plan <span className="text-red-500">*</span>
                {!isProPlan && (
                  <span className="text-gray-500 ml-2">
                    (Pro plan required to edit)
                  </span>
                )}
              </label>
              <Controller
                name="planId"
                control={form.control}
                rules={{ required: "Please select a membership plan" }}
                render={({ field }) => (
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                    disabled={!isProPlan}
                  >
                    <SelectTrigger
                      className={errors.planId ? "border-red-500" : ""}
                    >
                      <SelectValue placeholder="Select a membership plan" />
                    </SelectTrigger>
                    <SelectContent>
                      {membershipPlans.map((plan) => (
                        <SelectItem key={plan.id} value={plan.id}>
                          <div className="flex flex-col">
                            <span className="font-medium">{plan.name}</span>
                            <span className="text-xs text-gray-500">
                              ₹{(Number(plan.price) / 100).toFixed(2)} for{" "}
                              {plan.durationMonths} months
                              {plan.admissionFee > 0 &&
                                ` + ₹${(
                                  Number(plan.admissionFee) / 100
                                ).toFixed(2)} admission`}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.planId && (
                <span className="text-xs text-red-500">
                  {errors.planId.message}
                </span>
              )}
            </div>
          </div>

          <DialogFooter className="mt-6 flex-shrink-0">
            <DialogClose asChild>
              <Button
                type="button"
                variant="outline"
                onClick={handleModalClose}
              >
                Cancel
              </Button>
            </DialogClose>
            <Button
              type="submit"
              disabled={
                isSubmitting || uploadProgress > 0 || emailAvailable === false
              }
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving Changes...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
