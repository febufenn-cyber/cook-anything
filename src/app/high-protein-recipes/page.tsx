import CollectionView, { collectionMetadata } from "@/components/CollectionView";

export const generateMetadata = () => collectionMetadata("high-protein-recipes");

export default function Page() {
  return <CollectionView slug="high-protein-recipes" />;
}
