"use client";

import React, { useEffect, useRef, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

type ProfilePictureProps = {
    src: string;
    alt: string;
    editable?: boolean;
    onUploaded?: (url: string) => void;
    className?: string;
};

const AVATAR_BUCKET = "avatars";

function sanitizeFilename(name: string): string {
    // Take only the basename, replace spaces with dashes, and remove unsafe chars
    const base = name.split("/").pop() || "file";
    const noSpaces = base.replace(/\s+/g, "-");
    const safe = noSpaces.replace(/[^a-zA-Z0-9._-]/g, "");
    // Prevent empty or overly long names
    return (safe || "file").slice(0, 100);
}

const ProfilePicture: React.FC<ProfilePictureProps> = ({
    src,
    alt,
    editable = false,
    onUploaded,
    className = "",
}) => {
    const [localSrc, setLocalSrc] = useState<string>(src);
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    useEffect(() => {
        setLocalSrc(src);
    }, [src]);

    const handlePickFile = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange: React.ChangeEventHandler<HTMLInputElement> = async (
        e
    ) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploading(true);

        try {
            const supabase = createSupabaseBrowserClient();

            // Ensure user is logged in
            const {
                data: { user },
                error: userErr,
            } = await supabase.auth.getUser();

            if (userErr) throw userErr;
            if (!user) throw new Error("You must be signed in to upload an avatar.");

            // Upload to Supabase Storage
            const safeName = sanitizeFilename(file.name);
            const path = `${user.id}/${Date.now()}-${safeName}`;

            const { error: uploadErr } = await supabase.storage
                .from(AVATAR_BUCKET)
                .upload(path, file, {
                    upsert: true,
                    contentType: file.type || "image/*",
                });

            if (uploadErr) throw uploadErr;

            // Get a public URL (bucket should be public for this to work without signed URLs)
            const { data: pub } = supabase.storage
                .from(AVATAR_BUCKET)
                .getPublicUrl(path);

            const publicUrl = pub.publicUrl;
            if (!publicUrl) throw new Error("Failed to resolve public URL for avatar.");

            // Persist to auth user metadata so it loads next time
            const { error: updateErr } = await supabase.auth.updateUser({
                data: { avatar_url: publicUrl },
            });
            if (updateErr) {
                // Not fatal for UI — still update the localSrc
                // eslint-disable-next-line no-console
                console.warn("Failed to update user metadata with avatar_url:", updateErr);
            }

            setLocalSrc(publicUrl);
            onUploaded?.(publicUrl);
        } catch (err) {
            // eslint-disable-next-line no-console
            console.error("Avatar upload failed:", err);
            alert("Avatar upload failed. Please try again.");
        } finally {
            setUploading(false);
            // Reset the input so the same file can be chosen again if needed
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };

    return (
        <div className="flex flex-col items-center gap-2">
            <img
                src={localSrc}
                alt={alt}
                className={`w-70 h-70 rounded-xl object-cover shadow-md border ${className}`}
            />
            {editable && (
                <div className="flex items-center gap-2">
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        hidden
                        onChange={handleFileChange}
                    />
                    <Button type="button" onClick={handlePickFile} disabled={uploading}>
                        {uploading ? "Uploading..." : "Change photo"}
                    </Button>
                </div>
            )}
        </div>
    );
};

export default ProfilePicture;
