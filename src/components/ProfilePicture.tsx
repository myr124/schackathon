interface ProfilePictureProps {
    src: string;
    alt: string;
}

const ProfilePicture = ({ src, alt }: ProfilePictureProps) => {
    return (
        <img
            src={src}
            alt={alt}
            className="w-70 h-70  rounded-xl object-cover shadow-md border"
        />
    );
};

export default ProfilePicture;
