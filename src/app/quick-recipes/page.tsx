import CollectionView, { collectionMetadata } from "@/components/CollectionView";

export const generateMetadata = () => collectionMetadata("quick-recipes");

export default function Page() {
  return <CollectionView slug="quick-recipes" />;
}
