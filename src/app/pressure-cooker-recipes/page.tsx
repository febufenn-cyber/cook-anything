import CollectionView, { collectionMetadata } from "@/components/CollectionView";

export const generateMetadata = () => collectionMetadata("pressure-cooker-recipes");

export default function Page() {
  return <CollectionView slug="pressure-cooker-recipes" />;
}
