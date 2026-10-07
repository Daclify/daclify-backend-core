#pragma once
#include <eosio/crypto_ext.hpp>
#include <eosio/eosio.hpp>
#include <array>
#include <algorithm>
namespace daclify {
using evm_word=std::array<uint8_t,32>;
inline evm_word evm_uint(uint64_t value){evm_word out{};for(size_t i=0;i<8;i++){out[31-i]=value&255;value>>=8;}return out;}
inline evm_word evm_address_word(const eosio::checksum160& value){evm_word out{};const auto address=value.extract_as_byte_array();std::copy(address.begin(),address.end(),out.begin()+12);return out;}
inline evm_word evm_hash_words(std::initializer_list<evm_word> words){std::vector<char> bytes;bytes.reserve(words.size()*32);for(const auto& word:words)bytes.insert(bytes.end(),word.begin(),word.end());return eosio::keccak(bytes.data(),bytes.size()).extract_as_byte_array();}
inline evm_word evm_text(const std::string& value){return eosio::keccak(value.data(),value.size()).extract_as_byte_array();}
inline eosio::checksum256 evm_typed_digest(const eosio::checksum256& chain,eosio::name runtime,uint64_t evm_chain,const evm_word& body){
  const auto salt=evm_hash_words({chain.extract_as_byte_array(),evm_uint(runtime.value)});
  const auto domain=evm_hash_words({evm_text("EIP712Domain(string name,string version,uint256 chainId,bytes32 salt)"),evm_text("Daclify"),evm_text("1"),evm_uint(evm_chain),salt});
  std::array<char,66> data{};data[0]=0x19;data[1]=0x01;std::copy(domain.begin(),domain.end(),data.begin()+2);std::copy(body.begin(),body.end(),data.begin()+34);
  return eosio::keccak(data.data(),data.size());
}
inline eosio::checksum160 recover_evm_address(const eosio::checksum256& digest,const std::vector<char>& signature) {
  eosio::check(signature.size()==65,"EVM_SIGNATURE");
  // Ethereum r || s || v, with low s and v=27/28. No DER/Antelope signature ambiguity.
  const std::array<uint8_t,32> half_order={0x7f,0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xff,0x5d,0x57,0x6e,0x73,0x57,0xa4,0x50,0x1d,0xdf,0xe9,0x2f,0x46,0x68,0x1b,0x20,0xa0};
  std::array<uint8_t,32> s{};for(size_t i=0;i<32;i++)s[i]=uint8_t(signature[32+i]);
  eosio::check(!std::all_of(s.begin(),s.end(),[](uint8_t b){return b==0;})&&!std::lexicographical_compare(half_order.begin(),half_order.end(),s.begin(),s.end()),"EVM_SIGNATURE_CANONICAL");
  const auto v=uint8_t(signature[64]);eosio::check(v==27||v==28,"EVM_SIGNATURE_CANONICAL");
  std::array<char,65> compact{};compact[0]=char(v);std::copy(signature.begin(),signature.begin()+64,compact.begin()+1);
  const auto bytes=digest.extract_as_byte_array();std::array<char,65> public_key{};
  eosio::check(eosio::k1_recover(compact.data(),compact.size(),reinterpret_cast<const char*>(bytes.data()),bytes.size(),public_key.data(),public_key.size())==0&&public_key[0]==4,"EVM_SIGNATURE");
  const auto hashed=eosio::keccak(public_key.data()+1,64).extract_as_byte_array();
  std::array<uint8_t,20> address{};std::copy(hashed.begin()+12,hashed.end(),address.begin());
  return eosio::checksum160{address};
}
}
