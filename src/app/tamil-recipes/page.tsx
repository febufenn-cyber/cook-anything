import CollectionView, { collectionMetadata } from "@/components/CollectionView";

export const generateMetadata = () => collectionMetadata("tamil-recipes");

export default function Page() {
  return <CollectionView slug="tamil-recipes" />;
}
