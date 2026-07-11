import CollectionView, { collectionMetadata } from "@/components/CollectionView";

export const generateMetadata = () => collectionMetadata("rice-recipes");

export default function Page() {
  return <CollectionView slug="rice-recipes" />;
}
