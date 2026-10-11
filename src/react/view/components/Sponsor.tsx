interface SponsorProps {
    dark?: boolean;
    variant?: 'sidebar' | 'fixed';
}

// Keep viewer layout hooks without claiming upstream sponsorship.
export default function Sponsor(_props: SponsorProps) {
    return null;
}
